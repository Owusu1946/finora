import { describe, expect, it } from 'vitest';

import { evaluateAutomation } from './automation-store';

describe('evaluateAutomation', () => {
  it('matches a balance threshold and all conditions', () => {
    const result = evaluateAutomation({
      trigger: {
        type: 'balance_threshold',
        config: { currency: 'USD', operator: 'below', amount: 10_000 },
      },
      conditions: [{ type: 'currency_is', currency: 'USD' }],
      context: { currency: 'USD', walletBalance: 8_500 },
    });

    expect(result.matched).toBe(true);
    expect(result.failedConditions).toHaveLength(0);
  });

  it('reports failed conditions without preparing an action', () => {
    const result = evaluateAutomation({
      trigger: {
        type: 'gmail_invoice',
        config: { senderDomains: ['aws.amazon.com'], requirePdfAttachment: true },
      },
      conditions: [{ type: 'amount_max', amount: 500, currency: 'USD' }],
      context: { amount: 700, currency: 'USD', senderDomain: 'aws.amazon.com' },
    });

    expect(result.triggerMatches).toBe(true);
    expect(result.matched).toBe(false);
    expect(result.wouldPrepare).toBe(false);
    expect(result.failedConditions).toHaveLength(1);
  });

  it('matches weekly schedules at the configured local time', () => {
    const result = evaluateAutomation({
      trigger: {
        type: 'schedule',
        config: { frequency: 'weekly', weekday: 5, time: '10:00', timezone: 'Africa/Accra' },
      },
      conditions: [],
      context: {},
      now: new Date('2026-08-28T10:00:00'),
    });

    expect(result.matched).toBe(true);
  });
});
