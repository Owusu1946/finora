import type { UIMessage } from 'ai';

import {
  CreateRecurringRequestSchema,
  nextRecurringRun,
  type CreateRecurringRequest,
  type PreparedAction,
  type RecurringSchedule,
} from '@finora/shared';
import { and, asc, desc, eq, lte } from 'drizzle-orm';

import type { Database } from '../db/client';

import { prepareAction } from '../actions/actions';
import { PAYMENT_DUE_PART, postToAutomationsChat } from '../automations/deliver';
import { recurringSchedules } from '../db/schema';
import { fromMinor, maskTail, toMinor } from '../ledger/ledger';

type ScheduleRow = typeof recurringSchedules.$inferSelect;

/** Schedules handled per cron run; the rest wait for the next minute. */
const BATCH = 100;

export class RecurringError extends Error {
  constructor(
    public readonly code: 'recurring_not_found' | 'recurring_cancelled',
    public readonly status: 404 | 409,
  ) {
    super(code);
    this.name = 'RecurringError';
  }
}

export function toSchedule(row: ScheduleRow): RecurringSchedule {
  return {
    id: row.id,
    recipientName: row.recipientName,
    amount: fromMinor(row.amountMinor),
    currency: row.currency,
    frequency: row.frequency,
    destination: { ...row.destination, value: maskTail(row.destination.value) ?? '' },
    reference: row.reference,
    status: row.status,
    nextRunAt: row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastActionId: row.lastActionId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createSchedule(
  db: Database,
  userId: string,
  request: CreateRecurringRequest,
) {
  const input = CreateRecurringRequestSchema.parse(request);
  const now = new Date();
  const [row] = await db
    .insert(recurringSchedules)
    .values({
      clerkUserId: userId,
      recipientName: input.recipientName,
      amountMinor: toMinor(input.amount),
      currency: input.currency.toUpperCase(),
      frequency: input.frequency,
      destination: input.destination,
      reference: input.reference ?? null,
      status: input.activate ? 'active' : 'draft',
      nextRunAt: input.nextRunAt
        ? new Date(input.nextRunAt)
        : nextRecurringRun(now, input.frequency),
    })
    .returning();
  return toSchedule(row!);
}

export async function listSchedules(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(recurringSchedules)
    .where(eq(recurringSchedules.clerkUserId, userId))
    .orderBy(desc(recurringSchedules.createdAt))
    .limit(200);
  return rows.filter((row) => row.status !== 'draft').map(toSchedule);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownedSchedule(db: Database, userId: string, id: string) {
  if (!UUID.test(id)) throw new RecurringError('recurring_not_found', 404);
  const [row] = await db
    .select()
    .from(recurringSchedules)
    .where(and(eq(recurringSchedules.clerkUserId, userId), eq(recurringSchedules.id, id)))
    .limit(1);
  if (!row) throw new RecurringError('recurring_not_found', 404);
  return row;
}

export async function getSchedule(db: Database, userId: string, id: string) {
  return toSchedule(await ownedSchedule(db, userId, id));
}

/** Confirm (activate), pause, resume, or cancel. A cancelled schedule stays cancelled. */
export async function setScheduleStatus(
  db: Database,
  userId: string,
  id: string,
  status: 'active' | 'paused' | 'cancelled',
) {
  const row = await ownedSchedule(db, userId, id);
  if (row.status === 'cancelled') throw new RecurringError('recurring_cancelled', 409);
  const now = new Date();
  // Resuming after a pause skips the dates that passed while it was paused.
  let nextRunAt = row.nextRunAt;
  while (status === 'active' && nextRunAt <= now) {
    nextRunAt = nextRecurringRun(nextRunAt, row.frequency);
  }
  const [updated] = await db
    .update(recurringSchedules)
    .set({ status, nextRunAt, updatedAt: now })
    .where(eq(recurringSchedules.id, row.id))
    .returning();
  return toSchedule(updated!);
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** The Automations chat message for a payment that fell due. */
export function paymentDueMessage(input: {
  messageId: string;
  schedule: RecurringSchedule;
  action: PreparedAction | null;
  error?: string;
}): UIMessage {
  const { schedule, action } = input;
  const what = `${money(schedule.amount, schedule.currency)} to ${schedule.recipientName}`;
  if (!action) {
    return {
      id: input.messageId,
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `Your recurring payment of ${what} is due, but I couldn't prepare it: ${input.error ?? 'something went wrong'}. Nothing was sent.`,
        },
      ],
    };
  }
  return {
    id: input.messageId,
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: `Your recurring payment of ${what} is due. It's ready for you to approve; nothing moves until you do.`,
      },
      {
        type: 'dynamic-tool',
        toolName: PAYMENT_DUE_PART,
        toolCallId: `${PAYMENT_DUE_PART}_${input.messageId}`,
        state: 'output-available',
        input: { recurringId: schedule.id },
        output: { actionId: action.id, recurringId: schedule.id },
      },
    ],
  };
}

const ERROR_TEXT: Record<string, string> = {
  insufficient_funds: 'there isn’t enough in the wallet',
  wallet_not_found: 'you don’t have a wallet to pay it from',
  already_paid: 'this date was already paid',
};

/**
 * Prepares every recurring payment that is due and posts each to the user's
 * Automations chat. The schedule moves to its next date first, in a
 * conditional update, so overlapping cron runs prepare each date once.
 */
export async function runDueSchedules(db: Database, now = new Date()) {
  const due = await db
    .select()
    .from(recurringSchedules)
    .where(and(eq(recurringSchedules.status, 'active'), lte(recurringSchedules.nextRunAt, now)))
    .orderBy(asc(recurringSchedules.nextRunAt))
    .limit(BATCH);

  let prepared = 0;
  for (const row of due) {
    let nextRunAt = nextRecurringRun(row.nextRunAt, row.frequency);
    // Missed dates (the cron was down) prepare once, not once per missed date.
    while (nextRunAt <= now) nextRunAt = nextRecurringRun(nextRunAt, row.frequency);
    const [claimed] = await db
      .update(recurringSchedules)
      .set({ nextRunAt, lastRunAt: now, updatedAt: now })
      .where(
        and(
          eq(recurringSchedules.id, row.id),
          eq(recurringSchedules.status, 'active'),
          eq(recurringSchedules.nextRunAt, row.nextRunAt),
        ),
      )
      .returning();
    if (!claimed) continue;

    const dueDate = row.nextRunAt.toISOString().slice(0, 10);
    const messageId = `recurring_${row.id}_${dueDate}`;
    let action: PreparedAction | null = null;
    let error: string | undefined;
    try {
      action = await prepareAction(
        db,
        row.clerkUserId,
        {
          kind: 'payment',
          recipientName: row.recipientName,
          amount: fromMinor(row.amountMinor),
          currency: row.currency,
          destination: row.destination,
          reference: row.reference ?? `Recurring · ${row.recipientName}`,
          purpose: 'bill',
          relatedId: `recurring:${row.id}:${dueDate}`,
        },
        'automation',
      );
      await db
        .update(recurringSchedules)
        .set({ lastActionId: action.id })
        .where(eq(recurringSchedules.id, row.id));
      prepared += 1;
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      error = ERROR_TEXT[code] ?? 'something went wrong';
      console.error('[recurring:prepare]', { scheduleId: row.id, code });
    }
    await postToAutomationsChat(
      db,
      row.clerkUserId,
      paymentDueMessage({ messageId, schedule: toSchedule(claimed), action, error }),
    );
  }
  return prepared;
}
