import type { LedgerWallet } from '@finora/shared';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FX_RATES, INITIAL_WALLETS_DATA, type WalletItem } from '@/components/wallets/types';

import {
  fetchLedgerWallets,
  fundLedgerWallet,
  importLedgerWallets,
  LedgerApiError,
} from './ledger-api';
import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { refreshTransactions, transactionsToImport } from './transactions-storage';

/**
 * The user's wallet balances come from the Finora ledger (demo balances until
 * WeWire is live), so the app, chat, automations, and MCP all see the same
 * numbers. The last balances are cached for instant display; money only moves
 * on the server.
 */

/** Last balances from the ledger. */
const CACHE_KEY = 'finora.wallet-balances.v2';
/** Balances the app kept before the ledger; copied to it once, then ignored. */
const LEGACY_KEY = 'finora.wallet-balances.v1';
/** Refresh in the background when the cached balances are older than this. */
const STALE_MS = 15_000;

const listeners = new Set<() => void>();
let memory: { key: string; wallets: WalletItem[] } | null = null;
let lastFetch = 0;
let inflight: Promise<WalletItem[]> | null = null;

export class InsufficientFundsError extends Error {
  constructor(readonly wallet: WalletItem) {
    super(`Not enough in your ${wallet.name} wallet.`);
    this.name = 'InsufficientFundsError';
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeWallets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function rateFor(currency: string) {
  return FX_RATES[currency] ?? 1;
}

/** USD amount expressed in a wallet's own currency. */
export function usdInWalletCurrency(wallet: WalletItem, usd: number) {
  return usd / rateFor(wallet.currency);
}

/** `amount` in `currency`, expressed in the wallet's own currency (demo FX rates). */
export function amountInWalletCurrency(wallet: WalletItem, amount: number, currency: string) {
  if (currency === wallet.currency) return amount;
  return (amount * rateFor(currency)) / rateFor(wallet.currency);
}

/** Ledger wallets with the app's display details (name, badge, deposit details). */
function fromLedger(wallets: LedgerWallet[]): WalletItem[] {
  return wallets.flatMap((wallet) => {
    const details = INITIAL_WALLETS_DATA.find((item) => item.id === wallet.id);
    return details
      ? [{ ...details, balance: wallet.balance, usdEquivalent: wallet.usdEquivalent }]
      : [];
  });
}

async function readJson<T>(storageKey: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** The balances the app kept on the device before the ledger existed. */
async function legacyWallets() {
  const balances = await readJson<Record<string, number>>(userStorageKey(LEGACY_KEY));
  return INITIAL_WALLETS_DATA.map((wallet) =>
    typeof balances?.[wallet.id] === 'number'
      ? { ...wallet, balance: balances[wallet.id]!, usdEquivalent: 0 }
      : wallet,
  );
}

async function initializedWallets() {
  const response = await fetchLedgerWallets();
  if (response.initialized) return response;
  try {
    // First launch on the ledger: copy this phone's balances and history once.
    return await importLedgerWallets({
      wallets: (await legacyWallets()).map((wallet) => ({
        id: wallet.id,
        currency: wallet.currency,
        balance: Math.max(0, wallet.balance),
      })),
      transactions: await transactionsToImport(),
    });
  } catch (error) {
    // Another device (or a retry) got there first.
    if (error instanceof LedgerApiError && error.code === 'already_imported') {
      return fetchLedgerWallets();
    }
    throw error;
  }
}

/** Loads balances from the ledger and tells every screen showing them. */
export function refreshWallets(): Promise<WalletItem[]> {
  inflight ??= (async () => {
    const storageKey = userStorageKey(CACHE_KEY);
    lastFetch = Date.now();
    try {
      const wallets = fromLedger((await initializedWallets()).wallets);
      memory = { key: storageKey, wallets };
      if (isUserStorageKeyWritable(storageKey)) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(wallets)).catch(() => undefined);
      }
      notify();
      return wallets;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The user's wallets: the last ledger balances at once, refreshed in the background. */
export async function listWallets(): Promise<WalletItem[]> {
  const storageKey = userStorageKey(CACHE_KEY);
  const cached =
    memory?.key === storageKey ? memory.wallets : await readJson<WalletItem[]>(storageKey);
  if (cached) {
    memory = { key: storageKey, wallets: cached };
    if (Date.now() - lastFetch > STALE_MS) void refreshWallets().catch(() => undefined);
    return cached;
  }
  try {
    return await refreshWallets();
  } catch {
    return legacyWallets();
  }
}

/**
 * Refreshes balances and Activity after money moved on the server (a payment,
 * payroll, card load, or top-up).
 */
export async function refreshAfterMoneyMoved() {
  await Promise.all([refreshWallets().catch(() => undefined), refreshTransactions()]);
}

/** A demo deposit into a wallet. The caller asks for the passcode first. */
export async function fundWallet(input: {
  walletId: string;
  amount: number;
  method: string;
  counterparty?: string;
  reference?: string;
}) {
  const { walletId, ...request } = input;
  const result = await fundLedgerWallet(walletId, request);
  await refreshAfterMoneyMoved();
  return result.transaction;
}

/** Forget this session's balances (sign-out / reset). They stay on the account. */
export function clearWallets() {
  memory = null;
  lastFetch = 0;
  notify();
}
