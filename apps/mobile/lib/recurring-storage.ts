import {
  RecurringScheduleListResponseSchema,
  RecurringScheduleResponseSchema,
  type CreateRecurringRequest,
  type RecurringSchedule,
} from '@finora/shared';

import type { RecurringPayment, RecurringStatus } from '@/components/recurring/types';

import { ledgerRequest } from './ledger-api';

/**
 * Recurring payments are schedules on the Finora API. On each due date Finora
 * prepares the payment and posts it to the Automations chat for approval.
 */

const listeners = new Set<() => void>();
let cached: RecurringPayment[] = [];

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeRecurring(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toPayment(schedule: RecurringSchedule): RecurringPayment {
  return {
    id: schedule.id,
    recipientName: schedule.recipientName,
    amount: schedule.amount,
    currency: schedule.currency,
    frequency: schedule.frequency,
    nextRunAt: schedule.nextRunAt,
    // A draft (not yet confirmed) shows as not active.
    status: schedule.status === 'draft' ? 'paused' : schedule.status,
    destination: schedule.destination,
    reference: schedule.reference ?? undefined,
    createdAt: schedule.createdAt,
  };
}

export async function listRecurring(): Promise<RecurringPayment[]> {
  try {
    const { schedules } = RecurringScheduleListResponseSchema.parse(
      await ledgerRequest('/recurring'),
    );
    cached = schedules.map(toPayment);
  } catch (error) {
    if (__DEV__) console.warn('[recurring] load failed', error);
  }
  return cached;
}

export async function getRecurringSchedule(id: string) {
  return RecurringScheduleResponseSchema.parse(
    await ledgerRequest(`/recurring/${encodeURIComponent(id)}`),
  ).schedule;
}

/** Creates an active schedule. The caller asks for the passcode first. */
export async function createRecurring(request: CreateRecurringRequest) {
  const { schedule } = RecurringScheduleResponseSchema.parse(
    await ledgerRequest('/recurring', { method: 'POST', body: { ...request, activate: true } }),
  );
  notify();
  return toPayment(schedule);
}

export async function updateRecurringStatus(
  id: string,
  status: RecurringStatus,
): Promise<RecurringPayment | null> {
  try {
    const { schedule } = RecurringScheduleResponseSchema.parse(
      await ledgerRequest(`/recurring/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { status },
      }),
    );
    notify();
    return toPayment(schedule);
  } catch (error) {
    if (__DEV__) console.warn('[recurring] update failed', error);
    return null;
  }
}

export async function clearRecurring(): Promise<void> {
  cached = [];
  notify();
}
