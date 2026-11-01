import type { ApprovalPolicy } from '@finora/shared';

import { describe, expect, it } from 'vitest';

import { identifierKey } from '../payees/payees';
import { applyPolicies } from './evaluate';

const policies: ApprovalPolicy[] = [
  { id: '1', kind: 'amount_review', name: '', rule: '', enabled: true, amountUsd: 500 },
  { id: '2', kind: 'new_recipient', name: '', rule: '', enabled: true, amountUsd: null },
  { id: '3', kind: 'daily_limit', name: '', rule: '', enabled: true, amountUsd: 10_000 },
];

const facts = { amountUsd: 100, sentTodayUsd: 0, isNewRecipient: false, isOutflow: true };

describe('applyPolicies', () => {
  it('allows a small payment to a known account', () => {
    expect(applyPolicies(policies, facts)).toEqual({ outcome: 'allowed', reasons: [] });
  });

  it('flags large payments and new recipients for review', () => {
    const result = applyPolicies(policies, { ...facts, amountUsd: 900, isNewRecipient: true });
    expect(result.outcome).toBe('needs_review');
    expect(result.reasons).toHaveLength(2);
  });

  it('blocks a payment past the daily limit', () => {
    const result = applyPolicies(policies, { ...facts, amountUsd: 600, sentTodayUsd: 9_500 });
    expect(result.outcome).toBe('blocked');
    expect(result.reasons[0]).toContain('$10,000 daily limit');
  });

  it('ignores disabled policies and conversions', () => {
    const off = policies.map((policy) => ({ ...policy, enabled: false }));
    expect(applyPolicies(off, { ...facts, amountUsd: 50_000 }).outcome).toBe('allowed');
    expect(applyPolicies(policies, { ...facts, amountUsd: 50_000, isOutflow: false }).outcome).toBe(
      'allowed',
    );
  });
});

describe('identifierKey', () => {
  it('matches the same account however it is typed', () => {
    expect(identifierKey('024 123-4567')).toBe(identifierKey('0241234567'));
    expect(identifierKey('GB82 CLRB')).toBe('gb82clrb');
  });
});
