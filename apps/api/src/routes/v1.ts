import { Hono } from 'hono';

import { createPreparation, mockStore, newId } from '../mock/store';

type AppEnv = { Bindings: Env };

/**
 * Mock Finora platform routes.
 * Shape matches future live WeWire-backed handlers so MCP/mobile can stay stable.
 */
export const v1 = new Hono<AppEnv>();

// ─── Balances / wallets / receive ──────────────────────────────────────────

v1.get('/balances', (c) => {
  const balances = mockStore.wallets.map((w) => ({
    id: w.id,
    currency: w.currency,
    balance: Number(w.balance),
    status: w.status,
    subCustomerId: w.subCustomerId,
  }));
  return c.json({
    mode: 'mock',
    totalUsd: balances
      .filter((b) => b.currency === 'USD' || b.currency === 'USDT' || b.currency === 'USDC')
      .reduce((s, b) => s + b.balance, 0),
    balances,
  });
});

v1.get('/wallets', (c) => {
  const subCustomerId = c.req.query('subCustomerId');
  const currency = c.req.query('currency');
  let wallets = [...mockStore.wallets];
  if (subCustomerId) wallets = wallets.filter((w) => w.subCustomerId === subCustomerId);
  if (currency) wallets = wallets.filter((w) => w.currency === currency);
  return c.json({ mode: 'mock', wallets });
});

v1.get('/receive-methods', (c) => {
  return c.json({
    mode: 'mock',
    methods: [
      {
        id: 'va-usd',
        kind: 'virtual_account',
        currency: 'USD',
        title: 'USD virtual account',
        fields: [
          { label: 'IBAN', value: 'GB82 CLRB 0406 6800 0123 45' },
          { label: 'BIC', value: 'CLRBGB22' },
        ],
      },
      {
        id: 'momo-ghs',
        kind: 'mobile_money',
        currency: 'GHS',
        title: 'MTN MoMo collection',
        fields: [
          { label: 'Network', value: 'MTN' },
          { label: 'Number', value: '0550123456' },
        ],
      },
      {
        id: 'crypto-usdt',
        kind: 'crypto',
        currency: 'USDT',
        network: 'TRON',
        title: 'USDT · TRC-20',
        fields: [{ label: 'Address', value: 'TXyzFinoraMockDepositAddress9hQ2' }],
      },
    ],
  });
});

v1.get('/virtual-accounts', (c) =>
  c.json({
    mode: 'mock',
    accounts: [
      {
        id: 'va-usd',
        currency: 'USD',
        iban: 'GB82 CLRB 0406 6800 0123 45',
        bic: 'CLRBGB22',
        status: 'ACTIVE',
      },
    ],
  }),
);

v1.get('/crypto-addresses', (c) =>
  c.json({
    mode: 'mock',
    addresses: [
      {
        id: 'ca-usdt',
        currency: 'USDT',
        network: 'TRON',
        address: 'TXyzFinoraMockDepositAddress9hQ2',
        status: 'ACTIVE',
      },
    ],
  }),
);

// ─── Contacts ──────────────────────────────────────────────────────────────

v1.get('/contacts', (c) => {
  const q = (c.req.query('query') ?? '').toLowerCase();
  const favouriteOnly = c.req.query('favouriteOnly') === 'true';
  let items = [...mockStore.contacts];
  if (favouriteOnly) items = items.filter((x) => x.favourite);
  if (q) {
    items = items.filter(
      (x) => x.name.toLowerCase().includes(q) || x.identifier.toLowerCase().includes(q),
    );
  }
  return c.json({ mode: 'mock', contacts: items });
});

v1.post('/contacts', async (c) => {
  const body = await c.req.json<{
    name: string;
    method: string;
    identifier: string;
    currency?: string;
    favourite?: boolean;
  }>();
  const contact = {
    id: newId('c'),
    name: body.name,
    method: body.method,
    identifier: body.identifier,
    currency: body.currency ?? 'USD',
    favourite: body.favourite ?? false,
  };
  mockStore.contacts.unshift(contact);
  return c.json({ mode: 'mock', contact }, 201);
});

v1.post('/accounts/lookup', async (c) => {
  const body = await c.req.json<{ kind: string; value: string }>();
  return c.json({
    mode: 'mock',
    kind: body.kind,
    value: body.value,
    resolvedName: body.kind === 'mobile_money' ? 'Mobile money recipient' : 'Account holder',
    status: 'resolvable',
  });
});

// ─── Preparations (money movement → approval) ──────────────────────────────

v1.post('/payments/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('payment', body), 201);
});

v1.post('/disbursements/mobile-money/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('momo_disbursement', body), 201);
});

v1.post('/transfers/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('internal_transfer', body), 201);
});

v1.post('/conversions/prepare', async (c) => {
  const body = await c.req.json<{ from: string; to: string; amount: number }>();
  const rate =
    mockStore.fxRates.find((r) => r.from === body.from && r.to === body.to)?.rate ?? 1;
  const fee = Number((body.amount * 0.004).toFixed(2));
  const toAmount = Number(((body.amount - fee) * rate).toFixed(2));
  return c.json(
    createPreparation('conversion', {
      ...body,
      rate,
      fee,
      toAmount,
      quoteId: newId('quote'),
    }),
    201,
  );
});

// ─── Approvals ─────────────────────────────────────────────────────────────

v1.get('/approvals', (c) => {
  const status = c.req.query('status') ?? 'pending';
  const items =
    status === 'all'
      ? mockStore.approvals
      : mockStore.approvals.filter((a) => a.status === status);
  return c.json({ mode: 'mock', approvals: items });
});

v1.get('/approvals/:id', (c) => {
  const item = mockStore.approvals.find(
    (a) => a.id === c.req.param('id') || a.preparationId === c.req.param('id'),
  );
  if (!item) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', approval: item });
});

v1.post('/approvals/request', async (c) => {
  const body = await c.req.json<{ preparationId: string; note?: string }>();
  const item = mockStore.approvals.find((a) => a.preparationId === body.preparationId);
  if (!item) return c.json({ error: 'preparation_not_found' }, 404);
  return c.json({
    mode: 'mock',
    approvalId: item.id,
    status: item.status,
    push: 'queued',
    note: body.note,
    message: 'Human notified in Finora Approvals inbox.',
  });
});

/** Human app only — MCP must not call this to move money. */
v1.post('/approvals/:id/resolve', async (c) => {
  const body = await c.req.json<{ decision: 'approved' | 'rejected' }>();
  const item = mockStore.approvals.find((a) => a.id === c.req.param('id'));
  if (!item) return c.json({ error: 'not_found' }, 404);
  item.status = body.decision;
  item.resolvedAt = new Date().toISOString();
  if (body.decision === 'approved') {
    const txId = newId('WW');
    item.transactionId = txId;
    item.status = 'executed';
    mockStore.transactions.unshift({
      id: newId('tx'),
      wewireId: txId,
      type: item.kind === 'conversion' ? 'CONVERSION' : item.kind === 'momo_disbursement' ? 'DISBURSEMENT' : 'PAYOUT',
      channel:
        item.kind === 'momo_disbursement'
          ? 'MOBILE_MONEY'
          : item.kind === 'conversion'
            ? 'FX'
            : item.kind === 'internal_transfer'
              ? 'INTERNAL'
              : 'BANK',
      status: 'COMPLETED',
      amount: String((item.payload as { amount?: number }).amount ?? 0),
      currency: String((item.payload as { currency?: string }).currency ?? 'USD'),
      counterparty: String(
        (item.payload as { recipientName?: string }).recipientName ?? 'Counterparty',
      ),
      reference: String((item.payload as { reference?: string }).reference ?? item.preparationId),
      subCustomerId: 'sc_personal_001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return c.json({ mode: 'mock', approval: item });
});

// ─── Transactions ──────────────────────────────────────────────────────────

v1.get('/transactions', (c) => {
  const type = c.req.query('type');
  const status = c.req.query('status');
  const limit = Number(c.req.query('limit') ?? 50);
  let items = [...mockStore.transactions];
  if (type) items = items.filter((t) => t.type === type);
  if (status) items = items.filter((t) => t.status === status);
  return c.json({ mode: 'mock', transactions: items.slice(0, limit) });
});

v1.get('/transactions/:id', (c) => {
  const id = c.req.param('id');
  const item = mockStore.transactions.find((t) => t.id === id || t.wewireId === id);
  if (!item) return c.json({ error: 'not_found' }, 404);
  return c.json({
    mode: 'mock',
    transaction: item,
    timeline: [
      { id: 'prepared', label: 'Prepared', status: 'done', at: item.createdAt },
      { id: 'approved', label: 'Approved', status: 'done', at: item.createdAt },
      {
        id: 'settled',
        label: item.status === 'FAILED' ? 'Failed' : 'Settled',
        status: item.status === 'PROCESSING' ? 'active' : 'done',
        at: item.updatedAt,
      },
    ],
  });
});

// ─── FX ────────────────────────────────────────────────────────────────────

v1.get('/rates', (c) => c.json({ mode: 'mock', rates: mockStore.fxRates }));

v1.get('/rates/:from/:to', (c) => {
  const from = c.req.param('from').toUpperCase();
  const to = c.req.param('to').toUpperCase();
  const rate = mockStore.fxRates.find((r) => r.from === from && r.to === to);
  if (!rate) return c.json({ error: 'pair_not_found' }, 404);
  return c.json({ mode: 'mock', rate });
});

v1.post('/conversions/preview', async (c) => {
  const body = await c.req.json<{ from: string; to: string; amount: number }>();
  const rate =
    mockStore.fxRates.find((r) => r.from === body.from && r.to === body.to)?.rate ?? 1;
  const fee = Number((body.amount * 0.004).toFixed(2));
  const toAmount = Number(((body.amount - fee) * rate).toFixed(2));
  return c.json({
    mode: 'mock',
    from: body.from,
    to: body.to,
    fromAmount: body.amount,
    toAmount,
    rate,
    fee,
    feeCurrency: body.from,
    quoteId: newId('quote'),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
});

// ─── Sub-customers ─────────────────────────────────────────────────────────

v1.get('/subcustomers', (c) => {
  const status = c.req.query('status');
  const type = c.req.query('type');
  let items = [...mockStore.subcustomers];
  if (status) items = items.filter((s) => s.status === status);
  if (type) items = items.filter((s) => s.type === type);
  return c.json({ mode: 'mock', subcustomers: items });
});

v1.post('/subcustomers', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const sc = {
    id: newId('sc'),
    type: (body.type as 'INDIVIDUAL' | 'BUSINESS') ?? 'INDIVIDUAL',
    email: String(body.email ?? ''),
    country: String(body.country ?? 'GH'),
    firstName: body.firstName as string | undefined,
    lastName: body.lastName as string | undefined,
    businessName: body.businessName as string | undefined,
    status: 'ACTIVE' as const,
    onboardingStatus: 'NOT_STARTED' as const,
    purpose: (body.purpose as ('PAYMENTS')[]) ?? ['PAYMENTS'],
    createdAt: new Date().toISOString(),
  };
  mockStore.subcustomers.unshift(sc);
  return c.json({ mode: 'mock', subcustomer: sc }, 201);
});

v1.get('/subcustomers/:id', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', subcustomer: sc });
});

v1.patch('/subcustomers/:id/archive', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  sc.status = 'ARCHIVED';
  return c.json({ mode: 'mock', subcustomer: sc });
});

// ─── KYC ───────────────────────────────────────────────────────────────────

v1.post('/subcustomers/:id/kyc', async (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  sc.onboardingStatus = 'IN_PROGRESS';
  return c.json({ mode: 'mock', status: 'IN_PROGRESS', subCustomerId: sc.id });
});

v1.get('/subcustomers/:id/kyc-link', (c) => {
  const id = c.req.param('id');
  return c.json({
    mode: 'mock',
    url: `https://kyc.wewire.example/start?subCustomerId=${id}&token=mock`,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });
});

v1.get('/subcustomers/:id/kyc/requirements', (c) => {
  const id = c.req.param('id');
  const kyc = mockStore.kyc[id];
  return c.json({
    mode: 'mock',
    requirements: kyc?.requirements ?? [
      { id: 'id', label: 'Government ID', required: true, status: 'missing' },
    ],
  });
});

v1.post('/subcustomers/:id/kyc/beneficial-owners', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ fullName: string; ownershipPercent: number }>();
  const bucket = mockStore.kyc[id] ?? {
    requirements: [],
    beneficialOwners: [],
  };
  const owner = { id: newId('ubo'), ...body };
  bucket.beneficialOwners.push(owner);
  mockStore.kyc[id] = bucket;
  return c.json({ mode: 'mock', owner }, 201);
});

v1.post('/subcustomers/:id/kyc/submit', (c) => {
  const sc = mockStore.subcustomers.find((s) => s.id === c.req.param('id'));
  if (!sc) return c.json({ error: 'not_found' }, 404);
  sc.onboardingStatus = 'PENDING_REVIEW';
  return c.json({ mode: 'mock', status: 'PENDING_REVIEW' });
});

// ─── Invoices ──────────────────────────────────────────────────────────────

v1.get('/invoices', (c) => {
  const status = c.req.query('status');
  let items = [...mockStore.invoices];
  if (status && status !== 'all') items = items.filter((i) => i.status === status);
  return c.json({ mode: 'mock', invoices: items });
});

v1.get('/invoices/:id', (c) => {
  const inv = mockStore.invoices.find((i) => i.id === c.req.param('id'));
  if (!inv) return c.json({ error: 'not_found' }, 404);
  return c.json({ mode: 'mock', invoice: inv });
});

v1.post('/invoices/:id/prepare-payment', (c) => {
  const inv = mockStore.invoices.find((i) => i.id === c.req.param('id'));
  if (!inv) return c.json({ error: 'not_found' }, 404);
  return c.json(
    createPreparation('invoice_payment', {
      invoiceId: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      recipientName: inv.vendor,
      reference: inv.invoiceNumber,
    }),
    201,
  );
});

// ─── Recurring ─────────────────────────────────────────────────────────────

v1.get('/recurring', (c) => {
  const status = c.req.query('status');
  let items = [...mockStore.recurring];
  if (status && status !== 'all') items = items.filter((r) => r.status === status);
  return c.json({ mode: 'mock', recurring: items });
});

v1.post('/recurring/prepare', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(createPreparation('recurring', body), 201);
});

v1.patch('/recurring/:id', async (c) => {
  const body = await c.req.json<{ status: 'active' | 'paused' | 'cancelled' }>();
  const item = mockStore.recurring.find((r) => r.id === c.req.param('id'));
  if (!item) return c.json({ error: 'not_found' }, 404);
  item.status = body.status;
  return c.json({ mode: 'mock', recurring: item });
});
