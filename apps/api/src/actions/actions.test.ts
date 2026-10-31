import { describe, expect, it } from 'vitest';

import { ActionError, priceAction } from './actions';

const created = new Date('2026-10-31T10:00:00.000Z');

function wallet(walletKey: string, currency: string, balance: number) {
  return {
    id: `id-${walletKey}`,
    clerkUserId: 'user_1',
    walletKey,
    currency,
    balanceMinor: Math.round(balance * 100),
    importedAt: created,
    createdAt: created,
    updatedAt: created,
  };
}

const wallets = [wallet('w-usd', 'USD', 1_000), wallet('w-ghs', 'GHS', 20_000)];
const destination = { kind: 'mobile_money', label: 'MTN MoMo', value: '0241234567' };

describe('priceAction', () => {
  it('pays from the wallet in the payment currency', () => {
    const priced = priceAction(
      {
        kind: 'payment',
        recipientName: 'Ama',
        amount: 500,
        currency: 'GHS',
        destination,
        purpose: 'payment',
      },
      wallets,
    );
    expect(priced).toMatchObject({ amount: 500, currency: 'GHS', fee: 0, fundingAmount: 500 });
    expect(priced.wallet.walletKey).toBe('w-ghs');
  });

  it('converts when paying from a wallet in another currency', () => {
    const priced = priceAction(
      {
        kind: 'payment',
        recipientName: 'Ama',
        amount: 1_000,
        currency: 'GHS',
        destination,
        purpose: 'payment',
        fundingWalletId: 'w-usd',
      },
      wallets,
    );
    expect(priced.wallet.walletKey).toBe('w-usd');
    expect(priced.fundingAmount).toBe(65);
  });

  it('takes the conversion fee before converting', () => {
    const priced = priceAction(
      { kind: 'conversion', from: 'USD', to: 'GHS', amount: 100 },
      wallets,
    );
    expect(priced.fee).toBe(0.4);
    expect(priced.conversion?.toAmount).toBe(1532.31);
    expect(priced.conversion?.target.walletKey).toBe('w-ghs');
  });

  it('refuses a conversion into a wallet the user does not have', () => {
    expect(() =>
      priceAction({ kind: 'conversion', from: 'USD', to: 'EUR', amount: 10 }, wallets),
    ).toThrow(ActionError);
  });

  it('totals a plan', () => {
    const priced = priceAction(
      {
        kind: 'plan',
        title: 'Due today',
        currency: 'USD',
        items: [
          { title: 'AWS', amount: 42.5 },
          { title: 'Rent', amount: 900 },
        ],
      },
      wallets,
    );
    expect(priced).toMatchObject({ amount: 942.5, fundingAmount: 942.5, title: 'Due today' });
  });
});
