import { CurrencySchema } from '@finora/shared';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';

import type { Database } from '../db/client';
import type { AutomationQueueMessage } from './queue';

import { listActiveAutomationsForUser } from '../db/automation-store';
import { automations, invoices } from '../db/schema';

type AutomationRow = typeof automations.$inferSelect;
type Queue = { send: (message: AutomationQueueMessage) => Promise<unknown> };

const DAY_MS = 86_400_000;
/** Invoice-due rules are checked once a day, at 07:00 UTC (morning across Africa). */
const DAILY_SCAN_HOUR_UTC = 7;

export function isDailyInvoiceScanMinute(now: Date) {
  return now.getUTCHours() === DAILY_SCAN_HOUR_UTC && now.getUTCMinutes() === 0;
}

function currencyOf(value: string) {
  const parsed = CurrencySchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : undefined;
}

function money(amountMinor: number, currency: string) {
  return `${currency} ${(amountMinor / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function dueIn(days: number) {
  if (days <= 0) return 'due today';
  return days === 1 ? 'due tomorrow' : `due in ${days} days`;
}

/**
 * For every active "invoice due" rule, queues one event per unpaid invoice
 * that falls due inside its window. Event ids include the date, so each
 * invoice prompts at most once a day.
 */
export async function enqueueDueInvoiceEvents(
  db: Database,
  queue: Queue,
  rows: AutomationRow[],
  now: Date,
) {
  const dueRules = rows.filter(
    (row): row is AutomationRow & { trigger: { type: 'invoice_due' } } =>
      row.trigger.type === 'invoice_due',
  );
  const byUser = new Map<string, typeof dueRules>();
  for (const row of dueRules) {
    byUser.set(row.clerkUserId, [...(byUser.get(row.clerkUserId) ?? []), row]);
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = today.toISOString().slice(0, 10);
  let queued = 0;
  for (const [userId, rules] of byUser) {
    const window = Math.max(...rules.map((rule) => rule.trigger.config.dueWithinDays));
    const due = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.clerkUserId, userId),
          eq(invoices.status, 'due'),
          isNotNull(invoices.dueDate),
          gte(invoices.dueDate, today),
          lte(invoices.dueDate, new Date(today.getTime() + (window + 1) * DAY_MS)),
        ),
      );
    for (const invoice of due) {
      const days = Math.round((invoice.dueDate!.getTime() - today.getTime()) / DAY_MS);
      for (const rule of rules) {
        if (days > rule.trigger.config.dueWithinDays) continue;
        await queue.send({
          kind: 'evaluate',
          automationId: rule.id,
          eventId: `invoice_due:${invoice.id}:${day}`,
          context: {
            invoiceDueInDays: days,
            amount: invoice.amountMinor / 100,
            currency: currencyOf(invoice.currency),
            event: `Invoice ${invoice.invoiceNumber} from ${invoice.vendor}, ${money(invoice.amountMinor, invoice.currency)}, is ${dueIn(days)}`,
          },
        });
        queued += 1;
      }
    }
  }
  return queued;
}

/** Queues the user's "invoice arrives in Gmail" rules for a newly found invoice. */
export async function enqueueGmailInvoiceEvents(
  db: Database,
  queue: Queue,
  input: {
    userId: string;
    invoiceId: string;
    vendor: string;
    invoiceNumber: string;
    amountMinor: number;
    currency: string;
    senderDomain: string | null;
  },
) {
  const rules = (await listActiveAutomationsForUser(db, input.userId)).filter(
    (row) => row.trigger.type === 'gmail_invoice',
  );
  for (const rule of rules) {
    await queue.send({
      kind: 'evaluate',
      automationId: rule.id,
      eventId: `gmail_invoice:${input.invoiceId}`,
      context: {
        amount: input.amountMinor / 100,
        currency: currencyOf(input.currency),
        ...(input.senderDomain ? { senderDomain: input.senderDomain } : {}),
        event: `Invoice ${input.invoiceNumber} from ${input.vendor}, ${money(input.amountMinor, input.currency)}, arrived in Gmail`,
      },
    });
  }
  return rules.length;
}
