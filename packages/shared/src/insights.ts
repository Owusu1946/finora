import { z } from 'zod';

/**
 * Insights computed from the Finora ledger: spending, cash flow, upcoming
 * bills, and duplicate payments. Amounts are converted at demo FX rates.
 */

export const InsightPeriodSchema = z.enum(['week', 'month', 'last_month', 'quarter']);
export type InsightPeriod = z.infer<typeof InsightPeriodSchema>;

export const SpendingCategorySchema = z.object({
  category: z.string(),
  amount: z.number(),
  count: z.number().int(),
  /** Share of all money out, 0 to 1. */
  share: z.number(),
});

export const SpendingSummarySchema = z.object({
  period: InsightPeriodSchema,
  /** e.g. "October 2026" or "Last 7 days". */
  label: z.string(),
  from: z.string(),
  to: z.string(),
  currency: z.string(),
  inflow: z.number(),
  outflow: z.number(),
  net: z.number(),
  byCategory: z.array(SpendingCategorySchema),
  topRecipients: z.array(z.object({ name: z.string(), amount: z.number(), count: z.number() })),
});
export type SpendingSummary = z.infer<typeof SpendingSummarySchema>;

export const UpcomingBillSchema = z.object({
  label: z.string(),
  amount: z.number(),
  currency: z.string(),
  dueAt: z.string(),
  kind: z.enum(['recurring', 'invoice', 'payroll']),
});
export type UpcomingBill = z.infer<typeof UpcomingBillSchema>;

export const DuplicatePaymentSchema = z.object({
  counterparty: z.string(),
  amount: z.number(),
  currency: z.string(),
  transactionIds: z.array(z.string()),
  firstAt: z.string(),
  lastAt: z.string(),
});
export type DuplicatePayment = z.infer<typeof DuplicatePaymentSchema>;

export const CashFlowForecastSchema = z.object({
  currency: z.string(),
  days: z.number().int(),
  startBalance: z.number(),
  endBalance: z.number(),
  lowestBalance: z.number(),
  lowestAt: z.string(),
  /** Average money in minus money out per day over the last 30 days. */
  averageDailyNet: z.number(),
  upcomingTotal: z.number(),
  points: z.array(z.object({ date: z.string(), balance: z.number() })),
});
export type CashFlowForecast = z.infer<typeof CashFlowForecastSchema>;

/** What the treasury card shows. */
export const TreasuryOverviewSchema = z.object({
  totalUsd: z.number(),
  balances: z.array(
    z.object({ currency: z.string(), balance: z.number(), usdEquivalent: z.number() }),
  ),
  upcomingOutflows: z.array(
    z.object({ label: z.string(), amount: z.number(), currency: z.string(), kind: z.string() }),
  ),
  notes: z.array(z.string()),
});
export type TreasuryOverview = z.infer<typeof TreasuryOverviewSchema>;

/** What the financial report card shows. */
export const FinancialReportSchema = z.object({
  title: z.string(),
  period: z.string(),
  inflow: z.number(),
  outflow: z.number(),
  net: z.number(),
  currency: z.string(),
  highlights: z.array(z.string()),
});
export type FinancialReport = z.infer<typeof FinancialReportSchema>;

export const TreasuryOverviewResponseSchema = z.object({ overview: TreasuryOverviewSchema });

export const InsightPeriodInputSchema = z
  .object({ period: InsightPeriodSchema.optional().describe('Defaults to this month') })
  .strict();
export const CashFlowInputSchema = z
  .object({ days: z.number().int().min(7).max(90).optional().describe('Defaults to 30') })
  .strict();
