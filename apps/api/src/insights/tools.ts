import {
  CashFlowInputSchema,
  DetectDuplicatePaymentsInputSchema,
  InsightPeriodInputSchema,
} from '@finora/shared';
import { tool, zodSchema } from 'ai';
import { z } from 'zod';

import type { Database } from '../db/client';

import { findDuplicatePayments } from './cash-flow';
import { buildHighlights, buildTreasury } from './highlights';
import { loadInsights } from './service';

export const INSIGHT_TOOL_NAMES = [
  'get_treasury_overview',
  'generate_financial_insights',
  'summarize_spending',
  'analyze_cash_flow',
  'detect_duplicate_payments',
  'predict_upcoming_bills',
  'list_expenses',
] as const;

type Purchase = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  spentAt: string;
  cardLabel?: string;
  status: 'posted' | 'pending';
};

/**
 * Read-only tools over the user's own ledger, bills, and card purchases.
 * Amounts are converted to USD at demo rates; balances are demo until WeWire.
 */
export function createInsightTools(input: {
  db: Database;
  userId: string;
  purchases: () => Promise<Purchase[]>;
}) {
  const { db, userId } = input;
  return {
    get_treasury_overview: tool({
      description:
        'Show the user\'s treasury: balances per wallet, bills coming up in the next 30 days, and where the balance is heading. Use for "treasury", "cash position", or "what\'s coming up".',
      inputSchema: zodSchema(z.object({}).strict()),
      execute: async () => ({ overview: buildTreasury(await loadInsights(db, userId)) }),
    }),
    generate_financial_insights: tool({
      description:
        'Write a financial report for a period: money in, money out, net, and highlights (biggest categories, spending changes vs the period before, possible double payments, low-balance warnings, bills due). Use for "how am I doing", "report", or "insights".',
      inputSchema: zodSchema(InsightPeriodInputSchema),
      execute: async ({ period }) => {
        const insights = await loadInsights(db, userId, { period });
        return {
          report: {
            title: 'Financial report',
            period: insights.summary.label,
            inflow: insights.summary.inflow,
            outflow: insights.summary.outflow,
            net: insights.summary.net,
            currency: insights.summary.currency,
            highlights: buildHighlights(insights),
          },
        };
      },
    }),
    summarize_spending: tool({
      description:
        'Break down spending for a period by category and top recipients, compared with the period before. Use for "how much did I spend", "where did my money go", or a named category.',
      inputSchema: zodSchema(InsightPeriodInputSchema),
      execute: async ({ period }) => {
        const { summary, previous, changes } = await loadInsights(db, userId, { period });
        return { summary, previous: { label: previous.label, outflow: previous.outflow }, changes };
      },
    }),
    analyze_cash_flow: tool({
      description:
        'Forecast the user\'s total balance over the next days from the last 30 days\' trend and known bills; reports the lowest point and when. Use for "will I have enough", "cash flow", or "when will I run low".',
      inputSchema: zodSchema(CashFlowInputSchema),
      execute: async ({ days }) => {
        const { forecast, upcoming } = await loadInsights(db, userId, { days });
        return { forecast, upcoming };
      },
    }),
    detect_duplicate_payments: tool({
      description:
        'Find payments that look sent twice: same recipient, amount, and currency within a window (default 48 hours). Payroll is left out. Use before paying again or when the user asks.',
      inputSchema: zodSchema(DetectDuplicatePaymentsInputSchema),
      execute: async ({ withinHours }) => {
        const { transactions } = await loadInsights(db, userId, { period: 'quarter' });
        return { duplicates: findDuplicatePayments(transactions, withinHours ?? 48) };
      },
    }),
    predict_upcoming_bills: tool({
      description:
        'List bills coming up: recurring payments, unpaid invoices with due dates, and the next payroll (assumed monthly, same as the last run). Use for "what do I have to pay" or "upcoming bills".',
      inputSchema: zodSchema(CashFlowInputSchema),
      execute: async ({ days }) => {
        const { upcoming, forecast } = await loadInsights(db, userId, { days });
        return { upcoming, total: forecast.upcomingTotal, currency: forecast.currency };
      },
    }),
    list_expenses: tool({
      description:
        'List recent purchases on the user\'s virtual cards (merchant, amount, card). Use for "card spending" or "business expenses".',
      inputSchema: zodSchema(z.object({}).strict()),
      execute: async () => {
        const expenses = await input.purchases();
        return {
          expenses,
          total: Math.round(expenses.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
          currency: 'USD',
        };
      },
    }),
  };
}

export const insightsPrompt = `Insights: for spending, reports, treasury, cash flow, upcoming bills, double payments, or card expenses, call the matching tool (summarize_spending, generate_financial_insights, get_treasury_overview, analyze_cash_flow, predict_upcoming_bills, detect_duplicate_payments, list_expenses) instead of estimating. Totals are in USD at demo rates; say so when the user deals in another currency. The forecast is a projection from the last 30 days, not a promise; say that when you give a date.`;
