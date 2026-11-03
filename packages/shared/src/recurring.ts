import { z } from 'zod';

import { RecurringFrequencySchema, type RecurringFrequency } from './enums';

/**
 * Recurring payments: a schedule stored on the Finora API. On each due date
 * Finora prepares that payment and posts it to the Automations chat for the
 * user to approve with their passcode. Nothing pays on its own.
 */

export const RecurringScheduleStatusSchema = z.enum(['draft', 'active', 'paused', 'cancelled']);
export type RecurringScheduleStatus = z.infer<typeof RecurringScheduleStatusSchema>;

const DestinationSchema = z.object({
  kind: z.enum(['mobile_money', 'bank_account', 'crypto_wallet']),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(120),
});

export const RecurringScheduleSchema = z.object({
  id: z.string(),
  recipientName: z.string(),
  amount: z.number(),
  currency: z.string(),
  frequency: RecurringFrequencySchema,
  /** The destination, masked to the last four characters. */
  destination: DestinationSchema,
  reference: z.string().nullable(),
  status: RecurringScheduleStatusSchema,
  nextRunAt: z.string(),
  lastRunAt: z.string().nullable(),
  /** The payment prepared on the last due date. */
  lastActionId: z.string().nullable(),
  createdAt: z.string(),
});
export type RecurringSchedule = z.infer<typeof RecurringScheduleSchema>;

export const CreateRecurringRequestSchema = z
  .object({
    recipientName: z.string().trim().min(1).max(120),
    amount: z.number().positive().max(100_000_000),
    currency: z.string().trim().min(3).max(12),
    frequency: RecurringFrequencySchema,
    destination: DestinationSchema,
    reference: z.string().trim().max(140).optional(),
    /** First due date; defaults to one period from now. */
    nextRunAt: z.iso.datetime({ offset: true }).optional(),
    /** False keeps it as a draft until the user confirms it (chat cards). */
    activate: z.boolean().default(true),
  })
  .strict();
export type CreateRecurringRequest = z.input<typeof CreateRecurringRequestSchema>;

export const UpdateRecurringRequestSchema = z
  .object({ status: z.enum(['active', 'paused', 'cancelled']) })
  .strict();

export const RecurringScheduleResponseSchema = z.object({ schedule: RecurringScheduleSchema });
export const RecurringScheduleListResponseSchema = z.object({
  schedules: z.array(RecurringScheduleSchema),
});

/** The due date after `from` for a schedule, keeping the time of day. */
export function nextRecurringRun(from: Date, frequency: RecurringFrequency) {
  const next = new Date(from);
  if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + (frequency === 'quarterly' ? 3 : 1));
  return next;
}
