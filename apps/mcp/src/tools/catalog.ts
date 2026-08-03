import type { ToolName } from '@finora/shared';

/** MCP tool → Finora API mapping (never WeWire). */
export const TOOL_CATALOG: Record<
  ToolName,
  {
    description: string;
    method: 'GET' | 'POST' | 'PATCH';
    path: string | ((args: Record<string, unknown>) => string);
    /** When true, body is sent as JSON (POST/PATCH). GET uses query. */
    body?: boolean;
  }
> = {
  ping: {
    description: 'Health check for the Finora MCP server',
    method: 'GET',
    path: '/health',
  },
  get_balances: {
    description: 'Get wallet balances for the Finora account',
    method: 'GET',
    path: '/v1/balances',
  },
  list_wallets: {
    description: 'List wallets, optionally filtered by sub-customer or currency',
    method: 'GET',
    path: (a) => {
      const q = new URLSearchParams();
      if (a.subCustomerId) q.set('subCustomerId', String(a.subCustomerId));
      if (a.currency) q.set('currency', String(a.currency));
      const qs = q.toString();
      return `/v1/wallets${qs ? `?${qs}` : ''}`;
    },
  },
  list_receive_methods: {
    description: 'List ways to receive money (VA, MoMo, crypto)',
    method: 'GET',
    path: '/v1/receive-methods',
  },
  list_virtual_accounts: {
    description: 'List virtual bank accounts for receiving fiat',
    method: 'GET',
    path: '/v1/virtual-accounts',
  },
  list_crypto_addresses: {
    description: 'List crypto deposit addresses',
    method: 'GET',
    path: '/v1/crypto-addresses',
  },
  search_contacts: {
    description: 'Search saved contacts / beneficiaries by name',
    method: 'GET',
    path: (a) => `/v1/contacts?query=${encodeURIComponent(String(a.query ?? ''))}`,
  },
  list_contacts: {
    description: 'List contacts; optionally favourites only',
    method: 'GET',
    path: (a) =>
      `/v1/contacts${a.favouriteOnly ? '?favouriteOnly=true' : ''}`,
  },
  save_contact: {
    description: 'Save a beneficiary contact after a payment',
    method: 'POST',
    path: '/v1/contacts',
    body: true,
  },
  lookup_account: {
    description: 'Resolve a MoMo number, bank account, or crypto address',
    method: 'POST',
    path: '/v1/accounts/lookup',
    body: true,
  },
  prepare_payment: {
    description:
      'Prepare a payout for human approval. Does NOT move money — creates an Approvals inbox item.',
    method: 'POST',
    path: '/v1/payments/prepare',
    body: true,
  },
  prepare_momo_disbursement: {
    description:
      'Prepare a mobile-money disbursement for human approval. Does NOT move money.',
    method: 'POST',
    path: '/v1/disbursements/mobile-money/prepare',
    body: true,
  },
  prepare_internal_transfer: {
    description:
      'Prepare an internal transfer between sub-customers for human approval.',
    method: 'POST',
    path: '/v1/transfers/prepare',
    body: true,
  },
  prepare_conversion: {
    description: 'Prepare an FX conversion for human approval (includes quote).',
    method: 'POST',
    path: '/v1/conversions/prepare',
    body: true,
  },
  list_approvals: {
    description: 'List approval requests (pending agent-prepared payments)',
    method: 'GET',
    path: (a) => `/v1/approvals?status=${encodeURIComponent(String(a.status ?? 'pending'))}`,
  },
  get_approval: {
    description: 'Get a single approval / preparation by id',
    method: 'GET',
    path: (a) => `/v1/approvals/${encodeURIComponent(String(a.approvalId))}`,
  },
  request_approval: {
    description: 'Notify the human that a preparation is waiting in Approvals',
    method: 'POST',
    path: '/v1/approvals/request',
    body: true,
  },
  list_transactions: {
    description: 'List wallet transactions',
    method: 'GET',
    path: (a) => {
      const q = new URLSearchParams();
      if (a.type) q.set('type', String(a.type));
      if (a.status) q.set('status', String(a.status));
      if (a.limit) q.set('limit', String(a.limit));
      const qs = q.toString();
      return `/v1/transactions${qs ? `?${qs}` : ''}`;
    },
  },
  get_transaction: {
    description: 'Get transaction detail (timeline, WeWire id, rail)',
    method: 'GET',
    path: (a) => `/v1/transactions/${encodeURIComponent(String(a.transactionId))}`,
  },
  list_fx_rates: {
    description: 'List available FX rates',
    method: 'GET',
    path: '/v1/rates',
  },
  get_fx_rate: {
    description: 'Get FX rate for a currency pair',
    method: 'GET',
    path: (a) => `/v1/rates/${a.from}/${a.to}`,
  },
  preview_conversion: {
    description: 'Preview an FX conversion quote without creating an approval',
    method: 'POST',
    path: '/v1/conversions/preview',
    body: true,
  },
  create_subcustomer: {
    description: 'Create a WeWire sub-customer (individual or business) via Finora',
    method: 'POST',
    path: '/v1/subcustomers',
    body: true,
  },
  list_subcustomers: {
    description: 'List sub-customers',
    method: 'GET',
    path: (a) => {
      const q = new URLSearchParams();
      if (a.status) q.set('status', String(a.status));
      if (a.type) q.set('type', String(a.type));
      const qs = q.toString();
      return `/v1/subcustomers${qs ? `?${qs}` : ''}`;
    },
  },
  get_subcustomer: {
    description: 'Get a sub-customer by id',
    method: 'GET',
    path: (a) => `/v1/subcustomers/${encodeURIComponent(String(a.subCustomerId))}`,
  },
  archive_subcustomer: {
    description: 'Archive a sub-customer',
    method: 'PATCH',
    path: (a) => `/v1/subcustomers/${encodeURIComponent(String(a.subCustomerId))}/archive`,
  },
  submit_subcustomer_kyc: {
    description: 'Submit KYC identity fields for a sub-customer',
    method: 'POST',
    path: (a) => `/v1/subcustomers/${encodeURIComponent(String(a.subCustomerId))}/kyc`,
    body: true,
  },
  get_subcustomer_kyc_link: {
    description: 'Get hosted KYC link for a sub-customer',
    method: 'GET',
    path: (a) => `/v1/subcustomers/${encodeURIComponent(String(a.subCustomerId))}/kyc-link`,
  },
  get_kyc_requirements: {
    description: 'List KYC document requirements (business onboarding)',
    method: 'GET',
    path: (a) =>
      `/v1/subcustomers/${encodeURIComponent(String(a.subCustomerId))}/kyc/requirements`,
  },
  add_beneficial_owner: {
    description: 'Add a beneficial owner for business KYC',
    method: 'POST',
    path: (a) =>
      `/v1/subcustomers/${encodeURIComponent(String(a.subCustomerId))}/kyc/beneficial-owners`,
    body: true,
  },
  submit_kyc_for_review: {
    description: 'Submit business KYC package for review',
    method: 'POST',
    path: (a) => `/v1/subcustomers/${encodeURIComponent(String(a.subCustomerId))}/kyc/submit`,
  },
  list_invoices: {
    description: 'List supplier invoices (e.g. from Gmail)',
    method: 'GET',
    path: (a) => {
      const q = new URLSearchParams();
      if (a.status) q.set('status', String(a.status));
      const qs = q.toString();
      return `/v1/invoices${qs ? `?${qs}` : ''}`;
    },
  },
  get_invoice: {
    description: 'Get a single invoice',
    method: 'GET',
    path: (a) => `/v1/invoices/${encodeURIComponent(String(a.invoiceId))}`,
  },
  prepare_invoice_payment: {
    description: 'Prepare payment for a supplier invoice (requires human approval)',
    method: 'POST',
    path: (a) => `/v1/invoices/${encodeURIComponent(String(a.invoiceId))}/prepare-payment`,
  },
  prepare_recurring_payment: {
    description: 'Prepare a scheduled/recurring payment for human confirmation',
    method: 'POST',
    path: '/v1/recurring/prepare',
    body: true,
  },
  list_recurring_payments: {
    description: 'List recurring / scheduled payments',
    method: 'GET',
    path: (a) => {
      const q = new URLSearchParams();
      if (a.status) q.set('status', String(a.status));
      const qs = q.toString();
      return `/v1/recurring${qs ? `?${qs}` : ''}`;
    },
  },
  update_recurring_payment: {
    description: 'Pause, resume, or cancel a recurring payment',
    method: 'PATCH',
    path: (a) => `/v1/recurring/${encodeURIComponent(String(a.recurringId))}`,
    body: true,
  },
};
