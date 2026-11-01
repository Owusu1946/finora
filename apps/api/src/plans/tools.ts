import { tool, zodSchema } from 'ai';
import { z } from 'zod';

import type { Database } from '../db/client';

import { prepareDailyPlan } from './daily';

export const PLAN_TOOL_NAMES = ['prepare_daily_plan'] as const;

export function createPlanTools(input: { db: Database; userId: string }) {
  return {
    prepare_daily_plan: tool({
      description:
        'Handle everything that needs attention today: gathers payments waiting for approval (including recurring payments that fell due), unpaid payroll, and invoices due in the next 3 days, adds a conversion when a wallet would fall short, and prepares it all as one plan. The chat shows a card the user approves once with their passcode; then each item is paid in turn. This never pays anything by itself.',
      inputSchema: zodSchema(z.object({}).strict()),
      execute: async () => {
        const { action, notes } = await prepareDailyPlan(input.db, input.userId, {
          source: 'chat',
        });
        if (!action) return { ok: true as const, empty: true as const, notes };
        return {
          ok: true as const,
          actionId: action.id,
          items: action.items,
          total: action.amount,
          currency: action.currency,
          policy: action.policy,
          notes,
          mode: action.mode,
        };
      },
    }),
  };
}

export const plansPrompt = `Daily plan: for "handle everything that needs attention today", "what do I need to pay today", or "pay everything due", call prepare_daily_plan. Summarize the items and total in one or two sentences and mention anything in notes (for example an invoice with no payout details). If it returns empty, say nothing needs attention and mention any notes. Never say the items were paid.`;
