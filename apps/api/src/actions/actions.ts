import {
  convertDemoAmount,
  DEMO_CONVERSION_FEE_RATE,
  PrepareActionRequestSchema,
  type ConversionActionInput,
  type ExecuteActionRequest,
  type PaymentActionInput,
  type PlanActionInput,
  type PolicyResult,
  type PrepareActionRequest,
  type PreparedAction,
  type PreparedActionSource,
} from '@finora/shared';
import { and, desc, eq, ne, sql } from 'drizzle-orm';

import type { Database } from '../db/client';

import { ledgerWallets, preparedActions } from '../db/schema';
import { ensureWallets, LedgerError, maskTail, settle, type Settlement } from '../ledger/ledger';
import { evaluateActionPolicy } from '../policies/evaluate';

export class ActionError extends Error {
  constructor(
    public readonly code:
      | 'action_not_found'
      | 'action_not_pending'
      | 'action_blocked'
      | 'already_paid'
      | 'conversion_wallet_missing',
    public readonly status: 404 | 409,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'ActionError';
  }
}

type ActionRow = typeof preparedActions.$inferSelect;
type WalletRow = typeof ledgerWallets.$inferSelect;
type Payload = PaymentActionInput | ConversionActionInput | PlanActionInput;

const round = (value: number) => Math.round(value * 100) / 100;

/** The wallet in `currency`, else USD, else the first one. */
function walletFor(wallets: WalletRow[], currency: string, preferred?: string | null) {
  return (
    (preferred ? wallets.find((wallet) => wallet.walletKey === preferred) : undefined) ??
    wallets.find((wallet) => wallet.currency === currency) ??
    wallets.find((wallet) => wallet.currency === 'USD') ??
    wallets[0]
  );
}

/** What an action costs and where it is paid from, at today's demo rates. */
export function priceAction(
  payload: Payload,
  wallets: WalletRow[],
  fundingWalletId?: string | null,
) {
  if (payload.kind === 'conversion') {
    const from = payload.from.toUpperCase();
    const to = payload.to.toUpperCase();
    const source = wallets.find((wallet) => wallet.currency === from);
    const target = wallets.find((wallet) => wallet.currency === to);
    if (!source || !target) {
      throw new ActionError('conversion_wallet_missing', 409, { currency: source ? to : from });
    }
    const fee = round(payload.amount * DEMO_CONVERSION_FEE_RATE);
    const toAmount = round(convertDemoAmount(payload.amount - fee, from, to));
    return {
      title: `${from} → ${to}`,
      amount: payload.amount,
      currency: from,
      fee,
      conversion: { from, to, toAmount, rate: convertDemoAmount(1, from, to), target },
      wallet: source,
      fundingAmount: payload.amount,
    };
  }
  const currency = payload.currency.toUpperCase();
  const amount =
    payload.kind === 'plan'
      ? round(payload.items.reduce((sum, item) => sum + item.amount, 0))
      : payload.amount;
  const wallet = walletFor(wallets, currency, fundingWalletId ?? payload.fundingWalletId);
  if (!wallet) throw new LedgerError('wallet_not_found', 404);
  return {
    title: payload.kind === 'plan' ? payload.title : payload.recipientName,
    amount,
    currency,
    fee: 0,
    conversion: null,
    wallet,
    fundingAmount: round(convertDemoAmount(amount, currency, wallet.currency)),
  };
}

function toPreparedAction(row: ActionRow, wallets: WalletRow[]): PreparedAction {
  const payload = row.payload as Payload;
  let priced: ReturnType<typeof priceAction> | null = null;
  try {
    priced = priceAction(payload, wallets, row.fundingWalletId);
  } catch {
    // A wallet it needed is gone; the action still shows, without funding.
  }
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    source: row.source,
    mode: 'demo',
    title: priced?.title ?? (payload.kind === 'payment' ? payload.recipientName : 'Action'),
    amount: priced?.amount ?? 0,
    currency: priced?.currency ?? '',
    fee: priced?.fee ?? 0,
    recipient:
      payload.kind === 'payment'
        ? {
            name: payload.recipientName,
            destination: {
              ...payload.destination,
              value: maskTail(payload.destination.value) ?? '',
            },
            purpose: payload.purpose,
            relatedId: payload.relatedId ?? null,
          }
        : null,
    conversion: priced?.conversion
      ? {
          from: priced.conversion.from,
          to: priced.conversion.to,
          toAmount: priced.conversion.toAmount,
          rate: priced.conversion.rate,
        }
      : null,
    items: payload.kind === 'plan' ? payload.items : [],
    reference: payload.kind === 'payment' ? (payload.reference ?? null) : null,
    funding: priced
      ? {
          walletId: priced.wallet.walletKey,
          currency: priced.wallet.currency,
          amount: priced.fundingAmount,
        }
      : null,
    policy: row.policy,
    transactionId: row.transactionId,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    executedAt: row.executedAt?.toISOString() ?? null,
  };
}

async function ownedAction(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(preparedActions)
    .where(and(eq(preparedActions.id, id), eq(preparedActions.clerkUserId, userId)))
    .limit(1);
  if (!row) throw new ActionError('action_not_found', 404);
  return row;
}

/** An executed action that already paid `relatedId` (an invoice, bill, or request). */
async function paidFor(db: Database, userId: string, relatedId: string, exceptId?: string) {
  const [row] = await db
    .select({ id: preparedActions.id })
    .from(preparedActions)
    .where(
      and(
        eq(preparedActions.clerkUserId, userId),
        eq(preparedActions.status, 'executed'),
        sql`${preparedActions.payload}->>'relatedId' = ${relatedId}`,
        exceptId ? ne(preparedActions.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return row ?? null;
}

async function priceAndCheck(db: Database, userId: string, request: PrepareActionRequest) {
  const payload = PrepareActionRequestSchema.parse(request) as Payload;
  if (payload.kind === 'payment' && payload.relatedId) {
    const paid = await paidFor(db, userId, payload.relatedId);
    if (paid) throw new ActionError('already_paid', 409, { actionId: paid.id });
  }
  const wallets = await ensureWallets(db, userId);
  const priced = priceAction(payload, wallets);
  const policy: PolicyResult = await evaluateActionPolicy(db, userId, {
    kind: payload.kind,
    amount: priced.amount,
    currency: priced.currency,
    recipient: payload.kind === 'payment' ? payload.destination.value : null,
  });
  return { payload, wallets, priced, policy };
}

/** Validates, prices, and policy-checks an action, then stores it for approval. */
export async function prepareAction(
  db: Database,
  userId: string,
  request: PrepareActionRequest,
  source: PreparedActionSource,
) {
  const { payload, wallets, priced, policy } = await priceAndCheck(db, userId, request);
  const [row] = await db
    .insert(preparedActions)
    .values({
      id: `act_${crypto.randomUUID().replaceAll('-', '')}`,
      clerkUserId: userId,
      kind: payload.kind,
      source,
      payload: payload as unknown as Record<string, unknown>,
      policy,
      fundingWalletId: priced.wallet.walletKey,
    })
    .returning();
  return toPreparedAction(row!, wallets);
}

/**
 * Replaces a pending action's details, e.g. after the user edited the amount
 * or recipient on the card, and checks it again. Same kind only.
 */
export async function updatePendingAction(
  db: Database,
  userId: string,
  id: string,
  request: PrepareActionRequest,
) {
  const row = await ownedAction(db, userId, id);
  const { payload, wallets, priced, policy } = await priceAndCheck(db, userId, request);
  if (payload.kind !== row.kind) throw new ActionError('action_not_pending', 409);
  const [updated] = await db
    .update(preparedActions)
    .set({
      payload: payload as unknown as Record<string, unknown>,
      policy,
      fundingWalletId: priced.wallet.walletKey,
      updatedAt: new Date(),
    })
    .where(and(eq(preparedActions.id, row.id), eq(preparedActions.status, 'pending_approval')))
    .returning();
  if (!updated) throw new ActionError('action_not_pending', 409, { status: row.status });
  return toPreparedAction(updated, wallets);
}

export async function getAction(db: Database, userId: string, id: string) {
  const row = await ownedAction(db, userId, id);
  return toPreparedAction(row, await ensureWallets(db, userId));
}

export async function listActions(
  db: Database,
  userId: string,
  filter: { status?: ActionRow['status']; relatedId?: string } = {},
  limit = 50,
) {
  const [rows, wallets] = await Promise.all([
    db
      .select()
      .from(preparedActions)
      .where(
        and(
          eq(preparedActions.clerkUserId, userId),
          filter.status ? eq(preparedActions.status, filter.status) : undefined,
          filter.relatedId
            ? sql`${preparedActions.payload}->>'relatedId' = ${filter.relatedId}`
            : undefined,
        ),
      )
      .orderBy(desc(preparedActions.createdAt))
      .limit(Math.min(limit, 200)),
    ensureWallets(db, userId),
  ]);
  return rows.map((row) => toPreparedAction(row, wallets));
}

function settlementFor(
  row: ActionRow,
  payload: Payload,
  priced: ReturnType<typeof priceAction>,
): Omit<Settlement, 'userId' | 'kind' | 'sourceId' | 'source'> {
  if (payload.kind === 'conversion' && priced.conversion) {
    return {
      direction: 'swap',
      currency: priced.currency,
      amount: priced.amount,
      toCurrency: priced.conversion.to,
      toAmount: priced.conversion.toAmount,
      fee: priced.fee,
      counterparty: priced.title,
      method: 'Conversion',
      legs: [
        { walletId: priced.wallet.walletKey, amount: -priced.amount },
        { walletId: priced.conversion.target.walletKey, amount: priced.conversion.toAmount },
      ],
    };
  }
  const converted = priced.wallet.currency !== priced.currency;
  const common = {
    direction: 'sent' as const,
    currency: priced.wallet.currency,
    amount: priced.fundingAmount,
    ...(converted ? { toCurrency: priced.currency, toAmount: priced.amount } : {}),
    counterparty: priced.title,
    legs: [{ walletId: priced.wallet.walletKey, amount: -priced.fundingAmount }],
  };
  if (payload.kind === 'plan') {
    return {
      ...common,
      method: 'Financial plan',
      reference: `${payload.items.length} items`,
      destination: null,
    };
  }
  if (payload.kind !== 'payment') throw new Error(`unsupported_action_${row.kind}`);
  return {
    ...common,
    method: payload.destination.label,
    reference: payload.reference ?? null,
    destination: payload.destination.value,
  };
}

/**
 * Executes an action the user approved with their passcode: the ledger moves
 * the money and the action is marked executed in one transaction. An action
 * executes once, so a retry can't pay twice.
 */
export async function executeAction(
  db: Database,
  userId: string,
  id: string,
  request: ExecuteActionRequest = {},
) {
  const row = await ownedAction(db, userId, id);
  if (row.status !== 'pending_approval') {
    throw new ActionError('action_not_pending', 409, { status: row.status });
  }
  if (row.policy.outcome === 'blocked') {
    throw new ActionError('action_blocked', 409, { reasons: row.policy.reasons });
  }
  const payload = row.payload as Payload;
  if (payload.kind === 'payment' && payload.relatedId) {
    const paid = await paidFor(db, userId, payload.relatedId, row.id);
    if (paid) throw new ActionError('already_paid', 409, { actionId: paid.id });
  }
  const wallets = await ensureWallets(db, userId);
  const priced = priceAction(payload, wallets, request.fundingWalletId ?? row.fundingWalletId);
  const settlement = settlementFor(row, payload, priced);
  const now = new Date();

  const transaction = await settle(
    db,
    { ...settlement, userId, kind: 'action', sourceId: row.id, source: row.source },
    (transactionId) => [
      db
        .update(preparedActions)
        .set({
          status: 'executed',
          transactionId,
          fundingWalletId: priced.wallet.walletKey,
          executedAt: now,
          updatedAt: now,
        })
        .where(and(eq(preparedActions.id, row.id), eq(preparedActions.status, 'pending_approval'))),
    ],
  );

  const executed = await ownedAction(db, userId, row.id);
  if (executed.status !== 'executed') {
    // Cancelled between the check and the payment: undo every balance change.
    await settle(db, {
      userId,
      kind: 'action_refund',
      sourceId: row.id,
      source: row.source,
      direction: 'received',
      currency: transaction.currency,
      amount: transaction.amount,
      counterparty: `${transaction.counterparty} refund`,
      method: 'Refund',
      legs: settlement.legs.map((leg) => ({ ...leg, amount: -leg.amount })),
    });
    throw new ActionError('action_not_pending', 409, { status: executed.status });
  }
  return toPreparedAction(executed, await ensureWallets(db, userId));
}

export async function cancelAction(db: Database, userId: string, id: string) {
  const [cancelled] = await db
    .update(preparedActions)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(preparedActions.id, id),
        eq(preparedActions.clerkUserId, userId),
        eq(preparedActions.status, 'pending_approval'),
      ),
    )
    .returning();
  if (!cancelled) {
    const row = await ownedAction(db, userId, id);
    throw new ActionError('action_not_pending', 409, { status: row.status });
  }
  return toPreparedAction(cancelled, await ensureWallets(db, userId));
}
