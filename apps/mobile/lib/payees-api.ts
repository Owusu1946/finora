import {
  ApprovalPolicyListResponseSchema,
  ApprovalPolicyResponseSchema,
  PayeeListResponseSchema,
  PayeeResponseSchema,
  type Payee,
  type PayeeKind,
  type PayeeMethod,
  type SavePayeeRequest,
  type UpdateApprovalPolicyRequest,
} from '@finora/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LedgerApiError, ledgerRequest } from './ledger-api';
import { isUserStorageKeyWritable, userStorageKey } from './session-storage';

/**
 * Saved contacts, suppliers, and approval policies on the Finora API, so chat
 * and MCP see the same payees and rules as the app. The last lists are cached
 * for when Finora can't be reached.
 */

const CACHE_KEY = 'finora.payees.v1';
const listeners = new Set<() => void>();
let memory: { key: string; payees: Payee[] } | null = null;
let importChecked = false;

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribePayees(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The payout method a free-text label like "MTN MoMo" or "TRC-20" describes. */
export function payeeMethodFor(label: string): PayeeMethod {
  const hint = label.toLowerCase();
  if (hint.includes('momo') || hint.includes('mobile') || hint.includes('mtn')) {
    return 'mobile_money';
  }
  if (/(trc|erc|usdt|usdc|crypto|wallet address|solana|polygon)/.test(hint)) return 'crypto_wallet';
  if (hint.includes('finora') || hint.startsWith('@')) return 'finora';
  return 'bank_account';
}

async function readCache(storageKey: string) {
  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Payee[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function remember(payees: Payee[]) {
  const storageKey = userStorageKey(CACHE_KEY);
  memory = { key: storageKey, payees };
  if (isUserStorageKeyWritable(storageKey)) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(payees)).catch(() => undefined);
  }
}

/**
 * All saved payees. The first time the account has none, the contacts this
 * phone saved before payees lived on the API are copied up once.
 */
export async function loadPayees(
  legacyContacts?: () => Promise<SavePayeeRequest[]>,
): Promise<Payee[]> {
  try {
    let { payees } = PayeeListResponseSchema.parse(await ledgerRequest('/payees'));
    if (!payees.length && !importChecked && legacyContacts) {
      importChecked = true;
      const legacy = await legacyContacts();
      if (legacy.length) {
        payees = PayeeListResponseSchema.parse(
          await ledgerRequest('/payees/import', { method: 'POST', body: { payees: legacy } }),
        ).payees;
      }
    }
    await remember(payees);
    return payees;
  } catch (error) {
    if (error instanceof LedgerApiError && error.code === 'payees_already_imported') {
      return loadPayees();
    }
    if (__DEV__) console.warn('[payees] load failed', error);
    const storageKey = userStorageKey(CACHE_KEY);
    return memory?.key === storageKey ? memory.payees : ((await readCache(storageKey)) ?? []);
  }
}

export async function listPayeesOfKind(
  kind: PayeeKind,
  legacyContacts?: () => Promise<SavePayeeRequest[]>,
) {
  return (await loadPayees(legacyContacts)).filter((payee) => payee.kind === kind);
}

/** Saves a payee (or updates the one with the same account). */
export async function savePayee(request: SavePayeeRequest) {
  const { payee } = PayeeResponseSchema.parse(
    await ledgerRequest('/payees', { method: 'POST', body: request }),
  );
  const current = memory?.payees ?? [];
  await remember([payee, ...current.filter((item) => item.id !== payee.id)]);
  notify();
  return payee;
}

export async function listApprovalPolicies() {
  return ApprovalPolicyListResponseSchema.parse(await ledgerRequest('/policies')).policies;
}

export async function updateApprovalPolicy(id: string, input: UpdateApprovalPolicyRequest) {
  return ApprovalPolicyResponseSchema.parse(
    await ledgerRequest(`/policies/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  ).policy;
}

/** Forget this session's payees (sign-out / reset). They stay on the account. */
export async function clearPayees() {
  memory = null;
  importChecked = false;
  await AsyncStorage.removeItem(userStorageKey(CACHE_KEY)).catch(() => undefined);
  notify();
}
