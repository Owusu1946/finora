import { getClerkInstance } from '@clerk/expo';
import {
  CardTransactionSchema,
  VirtualCardResponseSchema,
  VirtualCardSchema,
  type CardTransaction,
  type UpdateVirtualCardRequest,
} from '@finora/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState } from 'react-native';

import type {
  CreateVirtualCardInput,
  VirtualCard,
  VirtualCardStatus,
} from '@/components/cards/types';

import { getApiUrl } from './api-url';
import { isUserStorageKeyWritable, userStorageKey } from './session-storage';

/**
 * Virtual cards are issued by Lithic through the Finora API. Card numbers,
 * CVV, and expiry come live from the API and are only kept in memory while the
 * app runs; nothing card-sensitive is written to device storage.
 */

/** Pre-API releases saved cards (including card numbers) here; removed on first load. */
const LEGACY_CARDS_KEY = 'finora.virtual-cards.v1';
const BASE_UNREAD_KEY = 'finora.virtual-cards.unread.v1';
const REQUEST_TIMEOUT_MS = 20_000;
/** How long to wait for Clerk to restore the session on a cold start. */
const SESSION_WAIT_MS = 10_000;
const unreadKey = () => userStorageKey(BASE_UNREAD_KEY);

const listeners = new Set<() => void>();
const issuanceListeners = new Set<(card: VirtualCard) => void>();
/** Last cards fetched for this session, shown when the API can't be reached. */
let cachedCards: VirtualCard[] = [];
let legacyCleared = false;

export class VirtualCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VirtualCardError';
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeVirtualCards(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeVirtualCardIssuance(listener: (card: VirtualCard) => void): () => void {
  issuanceListeners.add(listener);
  return () => issuanceListeners.delete(listener);
}

export async function hasUnreadVirtualCards(): Promise<boolean> {
  return (await AsyncStorage.getItem(unreadKey()).catch(() => null)) === '1';
}

export async function clearUnreadVirtualCards(storageKey = unreadKey()): Promise<void> {
  if ((await AsyncStorage.getItem(storageKey).catch(() => null)) !== '1') return;
  if (isUserStorageKeyWritable(storageKey)) {
    await AsyncStorage.setItem(storageKey, '0').catch(() => undefined);
  }
  notify();
}

async function publishIssuance(card: VirtualCard) {
  if (AppState.currentState === 'active') {
    issuanceListeners.forEach((listener) => listener(card));
    return;
  }
  const storageKey = unreadKey();
  if (isUserStorageKeyWritable(storageKey)) {
    await AsyncStorage.setItem(storageKey, '1').catch(() => undefined);
  }
  notify();
}

async function clearLegacyCards() {
  if (legacyCleared) return;
  legacyCleared = true;
  await AsyncStorage.removeItem(userStorageKey(LEGACY_CARDS_KEY)).catch(() => undefined);
}

/**
 * Clerk restores the session asynchronously after a cold start, so a screen
 * that loads right away would otherwise find no token and show no cards.
 */
async function sessionToken() {
  const clerk = getClerkInstance();
  if (!clerk.loaded) {
    await new Promise<void>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe = () => {};
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      timer = setTimeout(finish, SESSION_WAIT_MS);
      unsubscribe = clerk.addListener(() => {
        if (clerk.loaded) finish();
      });
      if (clerk.loaded) finish();
    });
  }
  return (await clerk.session?.getToken()) ?? null;
}

async function cardsRequest(path: string, init?: { method: string; body: unknown }) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new VirtualCardError('Cards are unavailable right now.');
  const token = await sessionToken();
  if (!token) throw new VirtualCardError('Your session is not ready. Try again.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl}/v1/cards${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(payload.message)
          : 'Something went wrong with your card. Try again.';
      throw new VirtualCardError(message);
    }
    return payload;
  } catch (error) {
    if (error instanceof VirtualCardError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new VirtualCardError('The card service took too long. Try again.');
    }
    throw new VirtualCardError('Could not reach Finora. Check your connection.');
  } finally {
    clearTimeout(timeout);
  }
}

function replaceCached(card: VirtualCard) {
  const exists = cachedCards.some((item) => item.id === card.id);
  cachedCards = exists
    ? cachedCards.map((item) => (item.id === card.id ? card : item))
    : [card, ...cachedCards];
}

/** Validate each card on its own, so one malformed card can't blank the whole list. */
function parseCardList(payload: unknown): VirtualCard[] {
  const items =
    typeof payload === 'object' && payload !== null && 'cards' in payload ? payload.cards : null;
  if (!Array.isArray(items)) throw new VirtualCardError("Couldn't load your cards.");
  const cards: VirtualCard[] = [];
  for (const item of items) {
    const parsed = VirtualCardSchema.safeParse(item);
    if (parsed.success) cards.push(parsed.data);
    else if (__DEV__) console.warn('[cards] skipped an invalid card', parsed.error.issues);
  }
  return cards;
}

/**
 * The user's cards plus a user-facing error when they couldn't be loaded, so a
 * screen can tell "no cards" from "couldn't load". Falls back to the last list.
 */
export async function loadVirtualCards(): Promise<{ cards: VirtualCard[]; error: string | null }> {
  await clearLegacyCards();
  try {
    const cards = parseCardList(await cardsRequest(''));
    cachedCards = cards;
    return { cards, error: null };
  } catch (error) {
    if (__DEV__) console.warn('[cards] list failed', error);
    return {
      cards: cachedCards,
      error: error instanceof VirtualCardError ? error.message : "Couldn't load your cards.",
    };
  }
}

/** The user's cards; falls back to the last fetched list if the API can't be reached. */
export async function listVirtualCards(): Promise<VirtualCard[]> {
  return (await loadVirtualCards()).cards;
}

export async function getVirtualCard(id: string): Promise<VirtualCard | null> {
  try {
    const { card } = VirtualCardResponseSchema.parse(
      await cardsRequest(`/${encodeURIComponent(id)}`),
    );
    replaceCached(card);
    return card;
  } catch (error) {
    if (__DEV__) console.warn('[cards] get failed', error);
    return cachedCards.find((card) => card.id === id) ?? null;
  }
}

/** A card's recent purchases and refunds, newest first, or a user-facing error. */
export async function listCardTransactions(
  id: string,
): Promise<{ transactions: CardTransaction[]; error: string | null }> {
  try {
    const payload = await cardsRequest(`/${encodeURIComponent(id)}/transactions`);
    const items =
      typeof payload === 'object' && payload !== null && 'transactions' in payload
        ? payload.transactions
        : null;
    if (!Array.isArray(items)) throw new VirtualCardError("Couldn't load purchases.");
    const transactions: CardTransaction[] = [];
    for (const item of items) {
      const parsed = CardTransactionSchema.safeParse(item);
      if (parsed.success) transactions.push(parsed.data);
    }
    return { transactions, error: null };
  } catch (error) {
    if (__DEV__) console.warn('[cards] transactions failed', error);
    return {
      transactions: [],
      error: error instanceof VirtualCardError ? error.message : "Couldn't load purchases.",
    };
  }
}

export async function findVirtualCardByLabel(query: string): Promise<VirtualCard | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const cards = await listVirtualCards();
  return (
    cards.find((c) => c.label.toLowerCase() === q) ??
    cards.find((c) => c.label.toLowerCase().includes(q)) ??
    null
  );
}

/**
 * Issues a USD card. Throws `VirtualCardError` with a user-facing message on
 * failure. Pass `announce: false` when the caller shows its own confirmation,
 * so the global "Card ready" popup doesn't stack a second one on top.
 */
export async function createVirtualCard(
  input: CreateVirtualCardInput,
  options: { announce?: boolean } = {},
): Promise<VirtualCard> {
  const { card } = VirtualCardResponseSchema.parse(
    await cardsRequest('', {
      method: 'POST',
      body: {
        label: input.label.trim() || 'Virtual card',
        spendLimit: input.spendLimit,
        currency: 'USD',
      },
    }),
  );
  replaceCached(card);
  notify();
  if (options.announce !== false) await publishIssuance(card);
  return card;
}

/** Adds `amount` USD to a prepaid card. Throws `VirtualCardError` on failure. */
export async function topUpVirtualCard(id: string, amount: number): Promise<VirtualCard> {
  const { card } = VirtualCardResponseSchema.parse(
    await cardsRequest(`/${encodeURIComponent(id)}/top-up`, { method: 'POST', body: { amount } }),
  );
  replaceCached(card);
  notify();
  return card;
}

/** Updates a card; shows a system alert and resolves null when it fails. */
export async function updateVirtualCard(
  id: string,
  patch: Partial<Pick<VirtualCard, 'status' | 'spendLimit' | 'label'>>,
): Promise<VirtualCard | null> {
  const body: UpdateVirtualCardRequest = {
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.spendLimit !== undefined ? { spendLimit: patch.spendLimit } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };
  try {
    const { card } = VirtualCardResponseSchema.parse(
      await cardsRequest(`/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    );
    replaceCached(card);
    notify();
    return card;
  } catch (error) {
    Alert.alert(
      "Couldn't update card",
      error instanceof VirtualCardError ? error.message : 'Try again in a moment.',
    );
    return null;
  }
}

export async function setVirtualCardStatus(
  id: string,
  status: VirtualCardStatus,
): Promise<VirtualCard | null> {
  return updateVirtualCard(id, { status });
}

/** Forget this session's cards (sign-out / reset). Cards stay on the account. */
export async function clearVirtualCards(): Promise<void> {
  cachedCards = [];
  await clearUnreadVirtualCards(unreadKey());
  notify();
}
