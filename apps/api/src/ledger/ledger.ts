import type { BatchItem } from 'drizzle-orm/batch';

import {
  convertDemoAmount,
  DEMO_FX_USD_RATES,
  DEMO_STARTING_WALLETS,
  ImportWalletsRequestSchema,
  type ImportWalletsRequest,
  type LedgerTransaction,
  type LedgerWallet,
  type LedgerWalletsResponse,
} from '@finora/shared';
import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';

import type { Database } from '../db/client';

import { ledgerEntries, ledgerTransactions, ledgerWallets } from '../db/schema';

export class LedgerError extends Error {
  constructor(
    public readonly code:
      | 'insufficient_funds'
      | 'wallet_not_found'
      | 'already_settled'
      | 'already_imported',
    public readonly status: 404 | 409,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'LedgerError';
  }
}

type WalletRow = typeof ledgerWallets.$inferSelect;
type TransactionRow = typeof ledgerTransactions.$inferSelect;
type Source = TransactionRow['source'];

export const toMinor = (amount: number) => Math.round(amount * 100);
export const fromMinor = (amount: number) => amount / 100;

/** Shows only the last four characters of an account, phone, or card number. */
export function maskTail(value: string | null | undefined) {
  if (!value) return null;
  if (value.includes('•')) return value;
  const compact = value.replace(/\s+/g, '');
  return compact.length <= 4 ? compact : `•••• ${compact.slice(-4)}`;
}

function usdValue(currency: string, amount: number) {
  return amount * (DEMO_FX_USD_RATES[currency] ?? 0);
}

function toWallet(row: WalletRow): LedgerWallet {
  const balance = fromMinor(row.balanceMinor);
  return {
    id: row.walletKey,
    currency: row.currency,
    balance,
    usdEquivalent: Math.round(usdValue(row.currency, balance) * 100) / 100,
  };
}

export function toLedgerTransaction(row: TransactionRow): LedgerTransaction {
  return {
    id: row.id,
    direction: row.direction,
    status: row.status,
    currency: row.currency,
    amount: fromMinor(row.amountMinor),
    toCurrency: row.toCurrency,
    toAmount: row.toAmountMinor == null ? null : fromMinor(row.toAmountMinor),
    fee: row.feeMinor == null ? null : fromMinor(row.feeMinor),
    counterparty: row.counterparty,
    method: row.method,
    reference: row.reference,
    destination: row.destination,
    source: row.source,
    kind: row.kind,
    mode: 'demo',
    createdAt: row.createdAt.toISOString(),
  };
}

/** Postgres error code from a driver error, wrapped or not. */
function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    if ('code' in current && typeof current.code === 'string') return current.code;
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

async function walletRows(db: Database, userId: string) {
  return db
    .select()
    .from(ledgerWallets)
    .where(eq(ledgerWallets.clerkUserId, userId))
    .orderBy(ledgerWallets.createdAt);
}

/** The user's wallets, creating the starting demo wallets the first time. */
export async function ensureWallets(db: Database, userId: string) {
  const existing = await walletRows(db, userId);
  if (existing.length) return existing;
  await db
    .insert(ledgerWallets)
    .values(
      DEMO_STARTING_WALLETS.map((wallet) => ({
        clerkUserId: userId,
        walletKey: wallet.id,
        currency: wallet.currency,
        balanceMinor: toMinor(wallet.balance),
      })),
    )
    .onConflictDoNothing();
  return walletRows(db, userId);
}

export async function listLedgerWallets(
  db: Database,
  userId: string,
): Promise<LedgerWalletsResponse> {
  const rows = await ensureWallets(db, userId);
  const wallets = rows.map(toWallet);
  return {
    mode: 'demo',
    initialized: rows.some((row) => row.importedAt !== null),
    wallets,
    totalUsd:
      Math.round(wallets.reduce((sum, wallet) => sum + wallet.usdEquivalent, 0) * 100) / 100,
  };
}

/**
 * Copies the app's demo balances (and the history it kept on the device) into
 * the ledger, once. Refused after anything has been settled, so a stale phone
 * can never overwrite real ledger balances.
 */
export async function importWallets(db: Database, userId: string, input: ImportWalletsRequest) {
  const request = ImportWalletsRequestSchema.parse(input);
  const rows = await ensureWallets(db, userId);
  const [settled] = await db
    .select({ id: ledgerTransactions.id })
    .from(ledgerTransactions)
    .where(
      and(eq(ledgerTransactions.clerkUserId, userId), ne(ledgerTransactions.kind, 'device_import')),
    )
    .limit(1);
  if (settled || rows.some((row) => row.importedAt !== null)) {
    throw new LedgerError('already_imported', 409);
  }

  const now = new Date();
  const queries: BatchItem<'pg'>[] = request.wallets.map((wallet) =>
    db
      .insert(ledgerWallets)
      .values({
        clerkUserId: userId,
        walletKey: wallet.id,
        currency: wallet.currency.toUpperCase(),
        balanceMinor: toMinor(wallet.balance),
        importedAt: now,
      })
      .onConflictDoUpdate({
        target: [ledgerWallets.clerkUserId, ledgerWallets.walletKey],
        set: { balanceMinor: toMinor(wallet.balance), importedAt: now, updatedAt: now },
      }),
  );
  // Wallets the app doesn't have still count as copied.
  queries.push(
    db
      .update(ledgerWallets)
      .set({ importedAt: now, updatedAt: now })
      .where(eq(ledgerWallets.clerkUserId, userId)),
  );
  if (request.transactions.length) {
    queries.push(
      db
        .insert(ledgerTransactions)
        .values(
          request.transactions.map((tx) => ({
            id: `tx_${crypto.randomUUID().replaceAll('-', '')}`,
            clerkUserId: userId,
            direction: tx.direction,
            status: tx.status,
            currency: tx.currency.toUpperCase(),
            amountMinor: toMinor(tx.amount),
            toCurrency: tx.toCurrency?.toUpperCase() ?? null,
            toAmountMinor: tx.toAmount == null ? null : toMinor(tx.toAmount),
            feeMinor: tx.fee == null ? null : toMinor(tx.fee),
            counterparty: tx.counterparty || 'Unknown',
            method: tx.method || 'Transfer',
            reference: tx.reference ?? null,
            destination: maskTail(tx.destination),
            source: tx.source ?? 'manual',
            kind: 'device_import',
            sourceId: tx.id,
            createdAt: new Date(tx.timestamp),
          })),
        )
        .onConflictDoNothing(),
    );
  }
  await db.batch(queries as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  return listLedgerWallets(db, userId);
}

export type SettlementLeg = {
  /** Wallet key, e.g. `w-usd`. */
  walletId: string;
  /** Signed, in the wallet's own currency: negative takes money out. */
  amount: number;
};

export type Settlement = {
  userId: string;
  kind: string;
  /** The record being settled; settling the same one twice is refused. */
  sourceId: string;
  source: Source;
  direction: TransactionRow['direction'];
  currency: string;
  amount: number;
  toCurrency?: string;
  toAmount?: number;
  fee?: number;
  counterparty: string;
  method: string;
  reference?: string | null;
  destination?: string | null;
  legs: SettlementLeg[];
};

/**
 * Records a money movement and its balance changes in one database
 * transaction. A wallet that would go below zero aborts the whole thing
 * (`insufficient_funds`), and the same source can only settle once
 * (`already_settled`). `alongside` runs in the same transaction, e.g. marking
 * the payroll run paid.
 */
export async function settle(
  db: Database,
  input: Settlement,
  alongside: (transactionId: string) => BatchItem<'pg'>[] = () => [],
) {
  const wallets = await ensureWallets(db, input.userId);
  const legs = input.legs
    .filter((leg) => toMinor(leg.amount) !== 0)
    .map((leg) => {
      const wallet = wallets.find((row) => row.walletKey === leg.walletId);
      if (!wallet) throw new LedgerError('wallet_not_found', 404, { walletId: leg.walletId });
      return { wallet, amountMinor: toMinor(leg.amount) };
    });

  const id = `tx_${crypto.randomUUID().replaceAll('-', '')}`;
  const now = new Date();
  const queries: BatchItem<'pg'>[] = [
    db.insert(ledgerTransactions).values({
      id,
      clerkUserId: input.userId,
      direction: input.direction,
      status: 'completed',
      currency: input.currency,
      amountMinor: toMinor(input.amount),
      toCurrency: input.toCurrency ?? null,
      toAmountMinor: input.toAmount == null ? null : toMinor(input.toAmount),
      feeMinor: input.fee == null ? null : toMinor(input.fee),
      counterparty: input.counterparty,
      method: input.method,
      reference: input.reference ?? null,
      destination: maskTail(input.destination),
      source: input.source,
      kind: input.kind,
      sourceId: input.sourceId,
      createdAt: now,
    }),
    ...legs.map(({ wallet, amountMinor }) =>
      db
        .update(ledgerWallets)
        .set({
          balanceMinor: sql`${ledgerWallets.balanceMinor} + ${amountMinor}`,
          updatedAt: now,
        })
        .where(eq(ledgerWallets.id, wallet.id)),
    ),
    ...(legs.length
      ? [
          db.insert(ledgerEntries).values(
            legs.map(({ wallet, amountMinor }) => ({
              walletId: wallet.id,
              transactionId: id,
              amountMinor,
              createdAt: now,
            })),
          ),
        ]
      : []),
    ...alongside(id),
  ];

  try {
    await db.batch(queries as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);
  } catch (error) {
    const code = pgCode(error);
    if (code === '23514') {
      const short = legs.find(({ amountMinor }) => amountMinor < 0)?.wallet;
      throw new LedgerError('insufficient_funds', 409, {
        walletId: short?.walletKey,
        currency: short?.currency,
      });
    }
    if (code === '23505') throw new LedgerError('already_settled', 409);
    throw error;
  }

  const [row] = await db
    .select()
    .from(ledgerTransactions)
    .where(eq(ledgerTransactions.id, id))
    .limit(1);
  return toLedgerTransaction(row!);
}

/**
 * What paying `amount` in `currency` takes from a wallet, in the wallet's
 * currency at the demo rates (rounded to cents).
 */
export async function walletCost(
  db: Database,
  userId: string,
  walletId: string,
  amount: number,
  currency: string,
) {
  const wallet = (await ensureWallets(db, userId)).find((row) => row.walletKey === walletId);
  if (!wallet) throw new LedgerError('wallet_not_found', 404, { walletId });
  return {
    wallet: toWallet(wallet),
    amount: Math.round(convertDemoAmount(amount, currency, wallet.currency) * 100) / 100,
  };
}

export async function listLedgerTransactions(
  db: Database,
  userId: string,
  options: { limit?: number; query?: string; direction?: TransactionRow['direction'] } = {},
) {
  const query = options.query?.trim();
  const rows = await db
    .select()
    .from(ledgerTransactions)
    .where(
      and(
        eq(ledgerTransactions.clerkUserId, userId),
        options.direction ? eq(ledgerTransactions.direction, options.direction) : undefined,
        query
          ? or(
              ilike(ledgerTransactions.counterparty, `%${query}%`),
              ilike(ledgerTransactions.reference, `%${query}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
  return rows.map(toLedgerTransaction);
}

export async function getLedgerTransaction(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(ledgerTransactions)
    .where(and(eq(ledgerTransactions.clerkUserId, userId), eq(ledgerTransactions.id, id)))
    .limit(1);
  return row ? toLedgerTransaction(row) : null;
}
