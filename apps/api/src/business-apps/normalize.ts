import type { BusinessAppConnectionStatus, BusinessBalance, BusinessPayment } from '@finora/shared';

import type { ComposioConnectedAccount } from './composio';

/** Currencies Stripe reports in whole units rather than cents. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function amount(value: unknown) {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : 0;
}

/**
 * Composio wraps provider responses differently per tool: the list may be the
 * result itself, its `data`, or `data.data`. Returns the first array found.
 */
export function findList(value: unknown, key = 'data'): unknown[] {
  if (Array.isArray(value)) return value;
  let current: unknown = value;
  for (let depth = 0; depth < 3; depth += 1) {
    const found = record(current)[key];
    if (Array.isArray(found)) return found;
    current = record(current).data;
  }
  return [];
}

function fromMinorUnits(value: unknown, currency: string) {
  const raw = amount(value);
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? raw : raw / 100;
}

function paymentStatus(value: unknown): BusinessPayment['status'] {
  const status = String(value ?? '').toLowerCase();
  if (['success', 'successful', 'succeeded', 'paid', 'completed'].includes(status)) {
    return 'successful';
  }
  if (['failed', 'abandoned', 'cancelled', 'canceled', 'declined'].includes(status)) {
    return 'failed';
  }
  if (['pending', 'processing', 'ongoing', 'queued'].includes(status)) return 'pending';
  if (['reversed', 'refunded'].includes(status)) return 'refunded';
  return 'other';
}

function personName(value: unknown) {
  const person = record(value);
  const name = [text(person.first_name), text(person.last_name)].filter(Boolean).join(' ');
  return name || text(person.name) || text(person.email) || null;
}

export function paystackPayments(data: unknown): BusinessPayment[] {
  return findList(data).map((item) => {
    const row = record(item);
    const currency = text(row.currency)?.toUpperCase() ?? 'NGN';
    return {
      app: 'paystack',
      id: text(row.id) ?? text(row.reference) ?? 'unknown',
      reference: text(row.reference),
      amount: fromMinorUnits(row.amount, currency),
      currency,
      status: paymentStatus(row.status),
      customer: personName(row.customer),
      channel: text(row.channel),
      paidAt: text(row.paid_at) ?? text(row.created_at),
    };
  });
}

export function flutterwavePayments(data: unknown): BusinessPayment[] {
  return findList(data).map((item) => {
    const row = record(item);
    return {
      app: 'flutterwave',
      id: text(row.id) ?? text(row.tx_ref) ?? 'unknown',
      reference: text(row.tx_ref),
      amount: amount(row.amount),
      currency: text(row.currency)?.toUpperCase() ?? 'NGN',
      status: paymentStatus(row.status),
      customer: personName(row.customer),
      channel: text(row.payment_type),
      paidAt: text(row.created_at),
    };
  });
}

export function stripePayments(data: unknown): BusinessPayment[] {
  return findList(data).map((item) => {
    const row = record(item);
    const currency = text(row.currency)?.toUpperCase() ?? 'USD';
    const created = amount(row.created);
    const refunded = row.refunded === true;
    return {
      app: 'stripe',
      id: text(row.id) ?? 'unknown',
      reference: text(row.payment_intent),
      amount: fromMinorUnits(row.amount, currency),
      currency,
      status: refunded ? 'refunded' : paymentStatus(row.status),
      customer:
        personName(row.billing_details) ?? text(row.receipt_email) ?? text(row.customer) ?? null,
      channel: text(record(row.payment_method_details).type),
      paidAt: created > 0 ? new Date(created * 1000).toISOString() : null,
    };
  });
}

export function paystackBalances(data: unknown): BusinessBalance[] {
  return findList(data).map((item) => {
    const row = record(item);
    const currency = text(row.currency)?.toUpperCase() ?? 'NGN';
    return {
      app: 'paystack',
      currency,
      available: fromMinorUnits(row.balance, currency),
      pending: null,
    };
  });
}

export function flutterwaveBalances(data: unknown): BusinessBalance[] {
  return findList(data).map((item) => {
    const row = record(item);
    const available = amount(row.available_balance);
    return {
      app: 'flutterwave',
      currency: text(row.currency)?.toUpperCase() ?? 'NGN',
      available,
      pending: Math.max(0, amount(row.ledger_balance) - available) || null,
    };
  });
}

export function stripeBalances(data: unknown): BusinessBalance[] {
  const pending = new Map<string, number>();
  for (const item of findList(data, 'pending')) {
    const row = record(item);
    const currency = text(row.currency)?.toUpperCase() ?? 'USD';
    pending.set(currency, fromMinorUnits(row.amount, currency));
  }
  return findList(data, 'available').map((item) => {
    const row = record(item);
    const currency = text(row.currency)?.toUpperCase() ?? 'USD';
    return {
      app: 'stripe',
      currency,
      available: fromMinorUnits(row.amount, currency),
      pending: pending.get(currency) ?? null,
    };
  });
}

/** Money received per currency. Currencies are never added together. */
export function totalsByCurrency(payments: BusinessPayment[]) {
  const totals = new Map<string, { currency: string; total: number; count: number }>();
  for (const payment of payments) {
    if (payment.status !== 'successful') continue;
    const entry = totals.get(payment.currency) ?? {
      currency: payment.currency,
      total: 0,
      count: 0,
    };
    entry.total = Math.round((entry.total + payment.amount) * 100) / 100;
    entry.count += 1;
    totals.set(payment.currency, entry);
  }
  return [...totals.values()];
}

const STATUS_RANK: Record<BusinessAppConnectionStatus, number> = {
  connected: 3,
  error: 2,
  pending: 1,
  disconnected: 0,
};

function accountStatus(status: string): BusinessAppConnectionStatus {
  if (status === 'ACTIVE') return 'connected';
  if (status === 'INITIATED' || status === 'INITIALIZING') return 'pending';
  if (status === 'FAILED' || status === 'EXPIRED') return 'error';
  return 'disconnected';
}

/** Best connection status per toolkit: one working account makes the app connected. */
export function appStatuses(accounts: ComposioConnectedAccount[]) {
  const statuses = new Map<string, BusinessAppConnectionStatus>();
  for (const account of accounts) {
    const next = accountStatus(account.status);
    const current = statuses.get(account.toolkit.slug) ?? 'disconnected';
    if (STATUS_RANK[next] > STATUS_RANK[current]) statuses.set(account.toolkit.slug, next);
  }
  return statuses;
}
