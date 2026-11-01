import {
  nextRecurringRun,
  type FinancialReport,
  type InsightPeriod,
  type UpcomingBill,
} from '@finora/shared';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';

import type { Database } from '../db/client';

import { invoices, ledgerTransactions, payrollRuns, recurringSchedules } from '../db/schema';
import { fromMinor, listLedgerTransactions, listLedgerWallets } from '../ledger/ledger';
import { findDuplicatePayments, forecastCashFlow } from './cash-flow';
import { buildHighlights, buildTreasury } from './highlights';
import { periodRange, spendingChanges, summarizeSpending } from './spending';

const DAY_MS = 86_400_000;

/**
 * Bills known to be coming in the next `days`: each due date of active
 * recurring payments, unpaid invoices with a due date, and the next payroll
 * (assumed monthly, same total as the last paid run).
 */
export async function upcomingBills(db: Database, userId: string, now = new Date(), days = 30) {
  const horizon = new Date(now.getTime() + days * DAY_MS);
  const [schedules, dueInvoices, [lastPayroll]] = await Promise.all([
    db
      .select()
      .from(recurringSchedules)
      .where(
        and(
          eq(recurringSchedules.clerkUserId, userId),
          eq(recurringSchedules.status, 'active'),
          lte(recurringSchedules.nextRunAt, horizon),
        ),
      ),
    db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.clerkUserId, userId),
          inArray(invoices.status, ['due', 'scheduled']),
          lte(invoices.dueDate, horizon),
        ),
      ),
    db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.clerkUserId, userId), eq(payrollRuns.status, 'completed')))
      .orderBy(desc(payrollRuns.executedAt))
      .limit(1),
  ]);

  const bills: UpcomingBill[] = [];
  for (const schedule of schedules) {
    for (
      let at = schedule.nextRunAt;
      at <= horizon;
      at = nextRecurringRun(at, schedule.frequency)
    ) {
      if (at < now) continue;
      bills.push({
        label: schedule.recipientName,
        amount: fromMinor(schedule.amountMinor),
        currency: schedule.currency,
        dueAt: at.toISOString(),
        kind: 'recurring',
      });
    }
  }
  for (const invoice of dueInvoices) {
    if (!invoice.dueDate) continue;
    bills.push({
      label: `${invoice.vendor} · ${invoice.invoiceNumber}`,
      amount: fromMinor(invoice.amountMinor),
      currency: invoice.currency,
      // An overdue invoice still has to be paid: count it as due now.
      dueAt: (invoice.dueDate < now ? now : invoice.dueDate).toISOString(),
      kind: 'invoice',
    });
  }
  if (lastPayroll?.executedAt) {
    const next = nextRecurringRun(lastPayroll.executedAt, 'monthly');
    if (next >= now && next <= horizon) {
      bills.push({
        label: 'Payroll (same as last run)',
        amount: fromMinor(lastPayroll.totalMinor),
        currency: lastPayroll.currency,
        dueAt: next.toISOString(),
        kind: 'payroll',
      });
    }
  }
  return bills.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** Everything the insight tools need, from one read of the ledger. */
export async function loadInsights(
  db: Database,
  userId: string,
  options: { period?: InsightPeriod; days?: number; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const period = options.period ?? 'month';
  const days = options.days ?? 30;
  const range = periodRange(period, now);
  // Enough history for the comparison period and the 30-day trend.
  const since = new Date(Math.min(range.previous.from.getTime(), now.getTime() - 30 * DAY_MS));
  const [transactions, { wallets }, upcoming] = await Promise.all([
    listLedgerTransactions(db, userId, { since, limit: 5_000 }),
    listLedgerWallets(db, userId),
    upcomingBills(db, userId, now, days),
  ]);
  const summary = summarizeSpending(transactions, range.current);
  const previous = summarizeSpending(transactions, range.previous);
  return {
    wallets,
    transactions,
    upcoming,
    summary,
    previous,
    changes: spendingChanges(summary, previous),
    duplicates: findDuplicatePayments(
      transactions.filter((tx) => Date.parse(tx.createdAt) >= now.getTime() - 30 * DAY_MS),
    ),
    forecast: forecastCashFlow({ wallets, transactions, upcoming, now, days }),
  };
}

export async function treasuryOverview(db: Database, userId: string) {
  const insights = await loadInsights(db, userId);
  return buildTreasury(insights);
}

export async function financialReport(
  db: Database,
  userId: string,
  period: InsightPeriod = 'month',
): Promise<FinancialReport> {
  const insights = await loadInsights(db, userId, { period });
  const { summary } = insights;
  return {
    title: 'Financial report',
    period: summary.label,
    inflow: summary.inflow,
    outflow: summary.outflow,
    net: summary.net,
    currency: summary.currency,
    highlights: buildHighlights(insights),
  };
}

/** Users who moved money recently, for the weekly insight message. */
export async function recentlyActiveUsers(db: Database, since: Date) {
  const rows = await db
    .selectDistinct({ userId: ledgerTransactions.clerkUserId })
    .from(ledgerTransactions)
    .where(gte(ledgerTransactions.createdAt, since))
    .limit(1_000);
  return rows.map((row) => row.userId);
}
