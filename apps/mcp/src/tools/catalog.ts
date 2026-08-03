import type { McpToolName } from '@finora/shared';

type CatalogEntry = {
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string | ((args: Record<string, unknown>) => string);
  /** When true, body is sent as JSON (POST/PATCH). GET uses query. */
  body?: boolean;
};

/**
 * Curated high-level MCP tool → Finora API mapping.
 * Lower-level platform routes are composed by the API behind these tools.
 * Never maps to execute / settle endpoints.
 */
export const TOOL_CATALOG: Record<McpToolName, CatalogEntry> = {
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
  search_recipient: {
    description: 'Search / resolve recipients by name or identifier',
    method: 'GET',
    path: (a) => `/v1/recipients/search?query=${encodeURIComponent(String(a.query ?? ''))}`,
  },
  prepare_payment: {
    description:
      'Prepare a payout for human approval. Does NOT move money — creates an Approvals inbox item.',
    method: 'POST',
    path: '/v1/payments/prepare',
    body: true,
  },
  request_approval: {
    description: 'Notify the human that a preparation or plan is waiting in Approvals',
    method: 'POST',
    path: '/v1/approvals/request',
    body: true,
  },
  get_payment_status: {
    description: 'Get status of a payment, preparation, or settled transaction',
    method: 'GET',
    path: (a) => {
      const id = a.paymentId ?? a.preparationId ?? a.transactionId ?? '';
      return `/v1/payments/status?id=${encodeURIComponent(String(id))}`;
    },
  },
  prepare_conversion: {
    description: 'Prepare an FX conversion for human approval (includes quote).',
    method: 'POST',
    path: '/v1/conversions/prepare',
    body: true,
  },
  prepare_invoice_payment: {
    description: 'Prepare payment for a supplier invoice (requires human approval)',
    method: 'POST',
    path: (a) => `/v1/invoices/${encodeURIComponent(String(a.invoiceId))}/prepare-payment`,
  },
  prepare_supplier_payment: {
    description: 'Prepare a supplier payment for human approval. Does NOT move money.',
    method: 'POST',
    path: '/v1/suppliers/prepare-payment',
    body: true,
  },
  prepare_payroll: {
    description: 'Prepare a payroll run for human approval. Does NOT move money.',
    method: 'POST',
    path: '/v1/payroll/prepare',
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
  list_invoices: {
    description: 'List supplier invoices',
    method: 'GET',
    path: (a) => {
      const q = new URLSearchParams();
      if (a.status) q.set('status', String(a.status));
      const qs = q.toString();
      return `/v1/invoices${qs ? `?${qs}` : ''}`;
    },
  },
  list_notifications: {
    description: 'List account notifications',
    method: 'GET',
    path: (a) => `/v1/notifications${a.unreadOnly ? '?unreadOnly=true' : ''}`,
  },
  create_financial_plan: {
    description:
      'Create a multi-item financial plan (payroll + invoices + rent, etc.) for a single human approval',
    method: 'POST',
    path: '/v1/plans',
    body: true,
  },
  begin_transaction: {
    description: 'Open an agent transaction spanning related prepare_* calls',
    method: 'POST',
    path: '/v1/agent-transactions',
    body: true,
  },
  commit_transaction: {
    description: 'Commit agent transaction and request human approval for all items',
    method: 'POST',
    path: (a) =>
      `/v1/agent-transactions/${encodeURIComponent(String(a.transactionId))}/commit`,
    body: true,
  },
  rollback_transaction: {
    description: 'Roll back agent transaction and cancel related preparations',
    method: 'POST',
    path: (a) =>
      `/v1/agent-transactions/${encodeURIComponent(String(a.transactionId))}/rollback`,
    body: true,
  },
  evaluate_policy: {
    description: 'Evaluate policy for an intended action before prepare',
    method: 'POST',
    path: '/v1/policies/check',
    body: true,
  },
  list_supported_payment_rails: {
    description: 'List supported payment rails (bank, MoMo, crypto, internal)',
    method: 'GET',
    path: '/v1/capabilities/rails',
  },
  list_supported_countries: {
    description: 'List supported countries for send/receive',
    method: 'GET',
    path: '/v1/capabilities/countries',
  },
  list_supported_assets: {
    description: 'List supported fiat and crypto assets',
    method: 'GET',
    path: '/v1/capabilities/assets',
  },
  get_recent_context: {
    description: 'Recent recipients, wallets, and transactions for pronoun / follow-up resolution',
    method: 'GET',
    path: (a) =>
      `/v1/context/recent${a.limit ? `?limit=${encodeURIComponent(String(a.limit))}` : ''}`,
  },
};
