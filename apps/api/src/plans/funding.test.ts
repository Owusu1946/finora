import type { LedgerWallet } from '@finora/shared';

import { describe, expect, it } from 'vitest';

import { planFunding } from './funding';

const wallets: LedgerWallet[] = [
  { id: 'w-usd', currency: 'USD', balance: 1_000, usdEquivalent: 1_000 },
  { id: 'w-ghs', currency: 'GHS', balance: 1_000, usdEquivalent: 65 },
];

describe('planFunding', () => {
  it('needs nothing when every wallet covers its items', () => {
    expect(planFunding(wallets, [{ walletId: 'w-ghs', amount: 900 }])).toEqual({
      conversions: [],
      uncovered: [],
    });
  });

  it('converts from spare money to cover a short wallet, fee included', () => {
    const { conversions, uncovered } = planFunding(wallets, [{ walletId: 'w-ghs', amount: 3_000 }]);
    expect(uncovered).toEqual([]);
    expect(conversions).toHaveLength(1);
    expect(conversions[0]).toMatchObject({ fromWalletId: 'w-usd', from: 'USD', to: 'GHS' });
    // 2,000 GHS short = $130, grossed up for the 0.4% fee.
    expect(conversions[0]!.amount).toBeCloseTo(130.53, 2);
  });

  it('reports what is still short when nothing spare is left', () => {
    const { uncovered } = planFunding(wallets, [
      { walletId: 'w-usd', amount: 1_000 },
      { walletId: 'w-ghs', amount: 2_000 },
    ]);
    expect(uncovered).toEqual([{ walletId: 'w-ghs', currency: 'GHS', amount: 1_000 }]);
  });
});
