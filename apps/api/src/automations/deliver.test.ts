import {
  automationPreparePrompt,
  describeAutomation,
  describeAutomationTrigger,
  type AutomationAction,
} from '@finora/shared';
import { describe, expect, it } from 'vitest';

import { automationMessage, automationsChatId } from './deliver';
import { isDailyInvoiceScanMinute } from './producers';

const payment: AutomationAction = {
  type: 'prepare_payment',
  config: {
    recipient: 'Kwame, MTN MoMo 0241234567',
    amount: 500,
    currency: 'GHS',
    purpose: 'rent',
  },
};

describe('automationMessage', () => {
  it('posts reminders as plain text', () => {
    const message = automationMessage({
      messageId: 'm1',
      automation: {
        id: 'a1',
        name: 'Morning check',
        action: { type: 'notify_chat', config: { message: 'Review yesterday’s sales.' } },
      },
    });
    expect(message).toEqual({
      id: 'm1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Morning check: Review yesterday’s sales.' }],
    });
  });

  it('attaches a ready card to rules that prepare money', () => {
    const message = automationMessage({
      messageId: 'm2',
      automation: { id: 'a2', name: 'Rent', action: payment },
      event: 'Invoice INV-9 from Landlord, GHS 500, is due tomorrow',
    });
    expect(message.parts[0]).toEqual({
      type: 'text',
      text: 'Your automation "Rent" ran. Invoice INV-9 from Landlord, GHS 500, is due tomorrow. It\'s ready to prepare a payment of GHS 500 to Kwame, MTN MoMo 0241234567 for rent for your approval. Nothing moves until you approve it.',
    });
    expect(message.parts[1]).toMatchObject({
      type: 'dynamic-tool',
      toolName: 'automation_ready',
      state: 'output-available',
      output: {
        automationId: 'a2',
        name: 'Rent',
        prompt:
          'Prepare a payment of GHS 500 to Kwame, MTN MoMo 0241234567 for rent. This is from my automation "Rent". Details: Invoice INV-9 from Landlord, GHS 500, is due tomorrow.',
      },
    });
  });

  it('gives each user one Automations chat', () => {
    expect(automationsChatId('user_1')).toBe('automations_user_1');
  });
});

describe('automation descriptions', () => {
  it('reads schedules and thresholds in plain English', () => {
    expect(
      describeAutomationTrigger({
        type: 'schedule',
        config: { frequency: 'weekly', time: '09:00', timezone: 'Africa/Accra', weekday: 5 },
      }),
    ).toBe('Every Friday at 09:00');
    expect(
      describeAutomationTrigger({
        type: 'schedule',
        config: { frequency: 'monthly', time: '08:00', timezone: 'UTC', dayOfMonth: 22 },
      }),
    ).toBe('On the 22nd of every month at 08:00');
    expect(
      describeAutomation({
        trigger: {
          type: 'balance_threshold',
          config: { currency: 'USD', operator: 'below', amount: 10_000 },
        },
        action: { type: 'notify_chat', config: { message: 'Top up the float' } },
      }),
    ).toBe(
      'When the USD balance goes below USD 10,000, Finora will remind you: "Top up the float".',
    );
  });

  it('has no prepare prompt for reminders', () => {
    expect(
      automationPreparePrompt('x', { type: 'notify_chat', config: { message: 'hi' } }),
    ).toBeNull();
    expect(
      automationPreparePrompt('FX', {
        type: 'prepare_conversion',
        config: { fromCurrency: 'USD', toCurrency: 'GHS', amount: 200, amountMode: 'fixed' },
      }),
    ).toBe('Convert USD 200 to GHS. This is from my automation "FX".');
  });
});

describe('isDailyInvoiceScanMinute', () => {
  it('runs once a day at 07:00 UTC', () => {
    expect(isDailyInvoiceScanMinute(new Date('2026-10-30T07:00:20Z'))).toBe(true);
    expect(isDailyInvoiceScanMinute(new Date('2026-10-30T07:01:00Z'))).toBe(false);
    expect(isDailyInvoiceScanMinute(new Date('2026-10-30T19:00:00Z'))).toBe(false);
  });
});
