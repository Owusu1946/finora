import { describe, expect, it } from 'vitest';

import {
  appStatuses,
  findList,
  flutterwaveBalances,
  flutterwavePayments,
  paystackBalances,
  paystackPayments,
  stripeBalances,
  stripePayments,
  totalsByCurrency,
} from './normalize';

describe('findList', () => {
  it('finds the list however Composio wraps it', () => {
    expect(findList([1])).toEqual([1]);
    expect(findList({ data: [1] })).toEqual([1]);
    expect(findList({ data: { data: [1], meta: {} } })).toEqual([1]);
    expect(findList({ data: { message: 'none' } })).toEqual([]);
    expect(findList(null)).toEqual([]);
  });
});

describe('paystackPayments', () => {
  it('converts kobo and pesewas to major units', () => {
    const [payment] = paystackPayments({
      data: {
        data: [
          {
            id: 4099,
            reference: 'ref_1',
            amount: 250_050,
            currency: 'GHS',
            status: 'success',
            channel: 'mobile_money',
            paid_at: '2026-10-29T10:00:00.000Z',
            customer: { first_name: 'Ama', last_name: 'Mensah', email: 'ama@example.com' },
          },
        ],
      },
    });
    expect(payment).toEqual({
      app: 'paystack',
      id: '4099',
      reference: 'ref_1',
      amount: 2_500.5,
      currency: 'GHS',
      status: 'successful',
      customer: 'Ama Mensah',
      channel: 'mobile_money',
      paidAt: '2026-10-29T10:00:00.000Z',
    });
  });

  it('marks abandoned and reversed payments', () => {
    const payments = paystackPayments([
      { id: 1, amount: 100, currency: 'NGN', status: 'abandoned', customer: { email: 'a@b.co' } },
      { id: 2, amount: 100, currency: 'NGN', status: 'reversed' },
    ]);
    expect(payments.map((payment) => payment.status)).toEqual(['failed', 'refunded']);
    expect(payments[0]?.customer).toBe('a@b.co');
  });
});

describe('flutterwavePayments', () => {
  it('keeps major-unit amounts', () => {
    expect(
      flutterwavePayments({
        data: [
          {
            id: 7,
            tx_ref: 'tx-7',
            amount: 15_000,
            currency: 'NGN',
            status: 'successful',
            payment_type: 'card',
            created_at: '2026-10-28T09:00:00.000Z',
            customer: { name: 'Tunde Bello' },
          },
        ],
      })[0],
    ).toMatchObject({ amount: 15_000, status: 'successful', customer: 'Tunde Bello' });
  });
});

describe('stripePayments', () => {
  it('handles cents, zero-decimal currencies, and refunds', () => {
    const payments = stripePayments({
      data: [
        { id: 'ch_1', amount: 1_999, currency: 'usd', status: 'succeeded', created: 1_800_000_000 },
        { id: 'ch_2', amount: 5_000, currency: 'xof', status: 'succeeded', refunded: true },
      ],
    });
    expect(payments[0]).toMatchObject({ amount: 19.99, currency: 'USD', status: 'successful' });
    expect(payments[0]?.paidAt).toBe(new Date(1_800_000_000_000).toISOString());
    expect(payments[1]).toMatchObject({ amount: 5_000, currency: 'XOF', status: 'refunded' });
  });
});

describe('balances', () => {
  it('normalizes each provider', () => {
    expect(paystackBalances({ data: { data: [{ currency: 'NGN', balance: 1_000_000 }] } })).toEqual(
      [{ app: 'paystack', currency: 'NGN', available: 10_000, pending: null }],
    );
    expect(
      flutterwaveBalances({
        data: [{ currency: 'KES', available_balance: 500, ledger_balance: 800 }],
      }),
    ).toEqual([{ app: 'flutterwave', currency: 'KES', available: 500, pending: 300 }]);
    expect(
      stripeBalances({
        data: {
          available: [{ currency: 'usd', amount: 12_000 }],
          pending: [{ currency: 'usd', amount: 3_000 }],
        },
      }),
    ).toEqual([{ app: 'stripe', currency: 'USD', available: 120, pending: 30 }]);
  });
});

describe('totalsByCurrency', () => {
  it('sums successful payments per currency without mixing currencies', () => {
    const base = {
      app: 'paystack',
      reference: null,
      customer: null,
      channel: null,
      paidAt: null,
    };
    expect(
      totalsByCurrency([
        { ...base, id: '1', amount: 10.1, currency: 'GHS', status: 'successful' },
        { ...base, id: '2', amount: 20.2, currency: 'GHS', status: 'successful' },
        { ...base, id: '3', amount: 99, currency: 'GHS', status: 'failed' },
        { ...base, id: '4', amount: 5, currency: 'NGN', status: 'successful' },
      ]),
    ).toEqual([
      { currency: 'GHS', total: 30.3, count: 2 },
      { currency: 'NGN', total: 5, count: 1 },
    ]);
  });
});

describe('appStatuses', () => {
  it('prefers a working account over failed or pending ones', () => {
    const statuses = appStatuses([
      { id: 'a', status: 'FAILED', toolkit: { slug: 'paystack' } },
      { id: 'b', status: 'ACTIVE', toolkit: { slug: 'paystack' } },
      { id: 'c', status: 'INITIATED', toolkit: { slug: 'whatsapp' } },
      { id: 'd', status: 'EXPIRED', toolkit: { slug: 'quickbooks' } },
    ]);
    expect(Object.fromEntries(statuses)).toEqual({
      paystack: 'connected',
      whatsapp: 'pending',
      quickbooks: 'error',
    });
  });
});
