import {
  convertDemoAmount,
  type LedgerWallet,
  type PlanChild,
  type PreparedAction,
  type PreparedActionSource,
} from '@finora/shared';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';

import type { Database } from '../db/client';

import { ActionError, cancelAction, listActions, prepareAction } from '../actions/actions';
import { invoices, payrollRuns } from '../db/schema';
import { fromMinor, listLedgerWallets } from '../ledger/ledger';
import { listPayees } from '../payees/payees';
import { planFunding, type PlannedCost } from './funding';

const DAY_MS = 86_400_000;
/** Prepared items older than this are left out of today's plan. */
const RECENT_DAYS = 14;
/** Invoices due within this many days count as needing attention. */
const INVOICE_DAYS = 3;

const PURPOSE_CATEGORY: Record<string, string> = {
  payment: 'Payments',
  supplier: 'Suppliers',
  invoice: 'Invoices',
  bill: 'Bills',
  transfer: 'Transfers',
};

type Item = {
  child: PlanChild;
  title: string;
  amount: number;
  currency: string;
  category: string;
  cost: PlannedCost;
};

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** The wallet to pay `currency` from: that currency's wallet, else USD, else the first. */
export function walletForCurrency(wallets: LedgerWallet[], currency: string) {
  return (
    wallets.find((wallet) => wallet.currency === currency) ??
    wallets.find((wallet) => wallet.currency === 'USD') ??
    wallets[0]
  );
}

function paymentItem(action: PreparedAction): Item | null {
  if (!action.funding) return null;
  return {
    child: { type: 'action', id: action.id },
    title: action.title,
    amount: action.amount,
    currency: action.currency,
    category: PURPOSE_CATEGORY[action.recipient?.purpose ?? 'payment'],
    cost: { walletId: action.funding.walletId, amount: action.funding.amount },
  };
}

/**
 * Prepares invoices due soon as payments, when a saved supplier matches the
 * vendor. Gmail invoices carry no payout details, so the rest become notes.
 */
async function invoicePayments(
  db: Database,
  userId: string,
  source: PreparedActionSource,
  pendingRelated: Set<string>,
  now: Date,
) {
  const due = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.clerkUserId, userId),
        eq(invoices.status, 'due'),
        lte(invoices.dueDate, new Date(now.getTime() + INVOICE_DAYS * DAY_MS)),
      ),
    );
  if (!due.length) return { actions: [] as PreparedAction[], notes: [] as string[] };
  const suppliers = await listPayees(db, userId, { kind: 'supplier' });
  const actions: PreparedAction[] = [];
  const notes: string[] = [];
  for (const invoice of due) {
    const relatedId = `invoice:${invoice.id}`;
    if (pendingRelated.has(relatedId)) continue;
    const vendor = invoice.vendor.toLowerCase();
    const supplier = suppliers.find(
      (item) =>
        item.name.toLowerCase() === vendor ||
        item.name.toLowerCase().includes(vendor) ||
        vendor.includes(item.name.toLowerCase()),
    );
    const what = `${invoice.vendor} ${invoice.invoiceNumber} (${money(fromMinor(invoice.amountMinor), invoice.currency)})`;
    if (!supplier) {
      notes.push(
        `${what} is due soon, but there are no payout details. Save ${invoice.vendor} as a supplier to include it.`,
      );
      continue;
    }
    try {
      actions.push(
        await prepareAction(
          db,
          userId,
          {
            kind: 'payment',
            recipientName: supplier.name,
            amount: fromMinor(invoice.amountMinor),
            currency: invoice.currency,
            destination: {
              kind: supplier.method,
              label: supplier.label,
              value: supplier.identifier,
            },
            reference: invoice.invoiceNumber,
            purpose: 'invoice',
            relatedId,
          },
          source,
        ),
      );
    } catch (error) {
      // Already paid: nothing to do today.
      if (error instanceof ActionError && error.code === 'already_paid') continue;
      throw error;
    }
  }
  return { actions, notes };
}

/**
 * "Handle everything that needs attention today": gathers prepared payments
 * waiting for approval (including recurring payments that fell due), unpaid
 * payroll runs, and invoices due soon; adds conversions where a wallet falls
 * short; and prepares it all as one plan the user approves once. Returns null
 * when there's nothing to do.
 */
export async function prepareDailyPlan(
  db: Database,
  userId: string,
  options: { source: PreparedActionSource; now?: Date },
) {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - RECENT_DAYS * DAY_MS);
  const [{ wallets }, pending, runs] = await Promise.all([
    listLedgerWallets(db, userId),
    listActions(db, userId, { status: 'pending_approval' }),
    db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.clerkUserId, userId),
          inArray(payrollRuns.status, ['pending_approval']),
          gte(payrollRuns.createdAt, since),
        ),
      ),
  ]);

  // Asking again replaces an earlier plan; its payments are picked up again below.
  for (const plan of pending.filter((action) => action.kind === 'plan')) {
    await cancelAction(db, userId, plan.id).catch(() => undefined);
  }
  const payments = pending.filter(
    (action) => action.kind === 'payment' && Date.parse(action.createdAt) >= since.getTime(),
  );
  const related = new Set(
    payments.map((action) => action.recipient?.relatedId).filter((id): id is string => Boolean(id)),
  );
  const invoiceWork = await invoicePayments(db, userId, options.source, related, now);

  const items: Item[] = [];
  for (const run of runs) {
    const wallet = walletForCurrency(wallets, run.currency);
    if (!wallet) continue;
    const total = fromMinor(run.totalMinor);
    items.push({
      child: { type: 'payroll_run', id: run.id },
      title: run.period ? `Payroll · ${run.period}` : 'Payroll',
      amount: total,
      currency: run.currency,
      category: 'Payroll',
      cost: {
        walletId: wallet.id,
        amount: Math.round(convertDemoAmount(total, run.currency, wallet.currency) * 100) / 100,
      },
    });
  }
  for (const action of [...payments, ...invoiceWork.actions]) {
    const item = paymentItem(action);
    if (item) items.push(item);
  }

  const notes = [...invoiceWork.notes];
  if (!items.length) return { action: null, notes };

  const funding = planFunding(
    wallets,
    items.map((item) => item.cost),
  );
  const conversions: Item[] = [];
  for (const conversion of funding.conversions) {
    const action = await prepareAction(
      db,
      userId,
      { kind: 'conversion', from: conversion.from, to: conversion.to, amount: conversion.amount },
      options.source,
    );
    conversions.push({
      child: { type: 'action', id: action.id },
      title: `Convert ${conversion.from} → ${conversion.to}`,
      amount: conversion.amount,
      currency: conversion.from,
      category: 'Conversions',
      cost: { walletId: conversion.fromWalletId, amount: conversion.amount },
    });
  }
  for (const short of funding.uncovered) {
    notes.push(
      `Your ${short.currency} wallet is still ${money(short.amount, short.currency)} short after using your other wallets; some payments may fail.`,
    );
  }

  // Convert first so the money is there, then payroll, then everything else.
  const ordered = [
    ...conversions,
    ...items.filter((item) => item.child.type === 'payroll_run'),
    ...items.filter((item) => item.child.type === 'action'),
  ];
  const action = await prepareAction(
    db,
    userId,
    {
      kind: 'plan',
      title: "Today's plan",
      currency: 'USD',
      items: ordered.map((item) => ({
        title: item.title.slice(0, 120),
        amount: item.amount,
        currency: item.currency,
        category: item.category,
      })),
      children: ordered.map((item) => item.child),
      notes: notes.map((note) => note.slice(0, 280)),
    },
    options.source,
  );
  return { action, notes };
}
