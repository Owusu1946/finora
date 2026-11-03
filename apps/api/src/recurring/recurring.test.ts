import { nextRecurringRun } from '@finora/shared';
import { describe, expect, it } from 'vitest';

import { firstRecurringRun } from '../ai/tools';
import { paymentDueMessage } from './recurring';

const now = new Date('2026-11-01T10:00:00.000Z');

describe('recurring dates', () => {
  it('moves on by one period', () => {
    expect(nextRecurringRun(now, 'weekly').toISOString()).toBe('2026-11-08T10:00:00.000Z');
    expect(nextRecurringRun(now, 'monthly').toISOString()).toBe('2026-12-01T10:00:00.000Z');
    expect(nextRecurringRun(now, 'quarterly').toISOString()).toBe('2027-02-01T10:00:00.000Z');
  });

  it('starts on the asked day of the month, never in the past', () => {
    expect(firstRecurringRun('monthly', { dayOfMonth: 25 }, now).toISOString()).toBe(
      '2026-11-25T09:00:00.000Z',
    );
    expect(
      firstRecurringRun('monthly', { dayOfMonth: 1, timeOfDay: '08:00' }, now).toISOString(),
    ).toBe('2026-12-01T08:00:00.000Z');
    expect(firstRecurringRun('weekly', {}, now).toISOString()).toBe('2026-11-08T09:00:00.000Z');
  });
});

describe('paymentDueMessage', () => {
  const schedule = {
    id: 'rec_1',
    recipientName: 'Office Rent GH',
    amount: 4_500,
    currency: 'GHS',
    frequency: 'monthly' as const,
    destination: { kind: 'bank_account' as const, label: 'GCB', value: '•••• 1234' },
    reference: null,
    status: 'active' as const,
    nextRunAt: now.toISOString(),
    lastRunAt: null,
    lastActionId: null,
    createdAt: now.toISOString(),
  };

  it('carries the prepared action for the approval card', () => {
    const message = paymentDueMessage({
      messageId: 'm1',
      schedule,
      action: { id: 'act_1' } as never,
    });
    expect(message.parts[1]).toMatchObject({
      type: 'dynamic-tool',
      toolName: 'payment_due',
      output: { actionId: 'act_1', recurringId: 'rec_1' },
    });
  });

  it('explains when the payment could not be prepared', () => {
    const message = paymentDueMessage({
      messageId: 'm2',
      schedule,
      action: null,
      error: 'you don’t have a wallet to pay it from',
    });
    expect(message.parts).toHaveLength(1);
    expect(message.parts[0]).toMatchObject({ type: 'text' });
  });
});
