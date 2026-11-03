import type { ImportWalletsRequest, LedgerTransaction } from '@finora/shared';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SupportedCurrency } from '@/components/ui/currency-icon';

import {
  currencySymbol,
  type Transaction,
  type TransactionTimelineStep,
} from '@/components/activity/types';

import { fetchLedgerTransaction, fetchLedgerTransactions } from './ledger-api';
import { isUserStorageKeyWritable, userStorageKey } from './session-storage';

/**
 * Activity comes from the Finora ledger: every payment, payroll, card load,
 * conversion, and top-up the server settled. The last list is cached for
 * instant display.
 */

const CACHE_KEY = 'finora.transactions.v2';
/** History the app kept before the ledger; copied to it once with the balances. */
const LEGACY_KEY = 'finora.transactions.v1';
/** Seeded demo rows from before the ledger (`tx-1`, `tx-2`, ...); never copied. */
const SEEDED_DEMO_ID = /^tx-\d+$/;

const listeners = new Set<() => void>();
let memory: { key: string; transactions: Transaction[] } | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeTransactions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ledger movements are recorded at once; there are no rails to wait for yet. */
function timeline(tx: LedgerTransaction): TransactionTimelineStep[] {
  return tx.kind === 'device_import'
    ? [{ id: 'settled', label: 'Recorded on this device', at: tx.createdAt, status: 'done' }]
    : [
        { id: 'approved', label: 'Approved', at: tx.createdAt, status: 'done' },
        { id: 'settled', label: 'Settled in Finora (demo)', at: tx.createdAt, status: 'done' },
      ];
}

function fromLedger(tx: LedgerTransaction): Transaction {
  const currency = tx.currency as SupportedCurrency;
  return {
    id: tx.id,
    direction: tx.direction,
    status: tx.status,
    currency,
    amount: tx.amount,
    symbol: currencySymbol(currency),
    counterparty: tx.counterparty,
    method: tx.method,
    timestamp: tx.createdAt,
    ...(tx.toCurrency
      ? {
          toCurrency: tx.toCurrency as SupportedCurrency,
          toAmount: tx.toAmount ?? undefined,
          toSymbol: currencySymbol(tx.toCurrency),
        }
      : {}),
    finoraId: tx.id,
    rail: tx.method,
    fee: tx.fee ?? undefined,
    feeCurrency: tx.fee == null ? undefined : tx.currency,
    reference: tx.reference ?? undefined,
    source: tx.source,
    destinationValue: tx.destination ?? undefined,
    timeline: timeline(tx),
  };
}

async function readCache(storageKey: string) {
  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Transaction[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Loads Activity from the ledger and tells every screen showing it. */
export async function refreshTransactions(): Promise<Transaction[] | null> {
  const storageKey = userStorageKey(CACHE_KEY);
  try {
    const transactions = (await fetchLedgerTransactions()).map(fromLedger);
    memory = { key: storageKey, transactions };
    if (isUserStorageKeyWritable(storageKey)) {
      await AsyncStorage.setItem(storageKey, JSON.stringify(transactions)).catch(() => undefined);
    }
    notify();
    return transactions;
  } catch (error) {
    if (__DEV__) console.warn('[activity] refresh failed', error);
    return null;
  }
}

/** Activity, newest first. Falls back to the last list when Finora can't be reached. */
export async function listTransactions(): Promise<Transaction[]> {
  const storageKey = userStorageKey(CACHE_KEY);
  const fresh = await refreshTransactions();
  if (fresh) return fresh;
  if (memory?.key === storageKey) return memory.transactions;
  return (await readCache(storageKey)) ?? [];
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  try {
    return fromLedger(await fetchLedgerTransaction(id));
  } catch {
    const storageKey = userStorageKey(CACHE_KEY);
    const cached =
      memory?.key === storageKey ? memory.transactions : ((await readCache(storageKey)) ?? []);
    return cached.find((tx) => tx.id === id) ?? null;
  }
}

/** The history this phone kept before the ledger, for the one-time copy. */
export async function transactionsToImport(): Promise<
  NonNullable<ImportWalletsRequest['transactions']>
> {
  const legacy = (await readCache(userStorageKey(LEGACY_KEY))) ?? [];
  return legacy
    .filter((tx) => !SEEDED_DEMO_ID.test(tx.id) && tx.amount >= 0)
    .slice(0, 500)
    .map((tx) => ({
      id: tx.id,
      direction: tx.direction,
      status: tx.status,
      currency: tx.currency,
      amount: tx.amount,
      ...(tx.toCurrency ? { toCurrency: tx.toCurrency, toAmount: tx.toAmount } : {}),
      ...(tx.fee == null ? {} : { fee: tx.fee }),
      counterparty: tx.counterparty.slice(0, 200),
      method: tx.method.slice(0, 80),
      ...(tx.reference ? { reference: tx.reference.slice(0, 280) } : {}),
      ...(tx.destinationValue ? { destination: tx.destinationValue.slice(0, 120) } : {}),
      ...(tx.source ? { source: tx.source } : {}),
      timestamp: tx.timestamp,
    }));
}

/** Forget this session's Activity (sign-out / reset). It stays on the account. */
export async function clearTransactions(): Promise<void> {
  memory = null;
  await AsyncStorage.removeItem(userStorageKey(CACHE_KEY)).catch(() => undefined);
  notify();
}
