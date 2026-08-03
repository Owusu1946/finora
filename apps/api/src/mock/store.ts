/**
 * In-memory mock Finora platform data for hackathon / local dev.
 * Swap handlers to call WewireClient when WEWIRE_API_KEY + live mode are set.
 */

export type MockApproval = {
  id: string;
  preparationId: string;
  kind:
    | 'payment'
    | 'momo_disbursement'
    | 'bank_transfer'
    | 'internal_transfer'
    | 'wallet_transfer'
    | 'conversion'
    | 'invoice_payment'
    | 'supplier_payment'
    | 'payroll'
    | 'usdt_transfer'
    | 'usdc_transfer'
    | 'recurring'
    | 'payment_request';
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled' | 'failed';
  agent?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
  transactionId?: string;
};

const now = () => new Date().toISOString();

export type MockSubCustomer = {
  id: string;
  type: 'INDIVIDUAL' | 'BUSINESS';
  email: string;
  country: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  onboardingStatus:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'REQUIRES_ACTION';
  purpose: Array<'PAYMENTS' | 'PAYROLL' | 'TREASURY' | 'MARKETPLACE' | 'OTHER'>;
  createdAt: string;
};

export type MockTransaction = {
  id: string;
  wewireId: string;
  type: 'PAYOUT' | 'PAYIN' | 'TRANSFER' | 'CONVERSION' | 'DISBURSEMENT' | 'FEE' | 'REFUND';
  channel: 'BANK' | 'MOBILE_MONEY' | 'CRYPTO' | 'INTERNAL' | 'FX' | 'CARD';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REQUIRES_APPROVAL';
  amount: string;
  currency: string;
  counterparty: string;
  reference: string;
  subCustomerId: string;
  createdAt: string;
  updatedAt: string;
};

export type MockRecurring = {
  id: string;
  recipientName: string;
  amount: number;
  currency: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  status: 'active' | 'paused' | 'cancelled';
  nextRunAt: string;
  destinationValue: string;
};

export const mockStore = {
  subcustomers: [
    {
      id: 'sc_personal_001',
      type: 'INDIVIDUAL',
      email: 'kenneth@finora.app',
      country: 'GH',
      firstName: 'Kenneth',
      lastName: 'Owusu',
      status: 'ACTIVE',
      onboardingStatus: 'APPROVED',
      purpose: ['PAYMENTS'],
      createdAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'sc_business_001',
      type: 'BUSINESS',
      email: 'ops@finora.business',
      country: 'GH',
      businessName: 'Finora Demo Ltd',
      status: 'ACTIVE',
      onboardingStatus: 'IN_PROGRESS',
      purpose: ['PAYMENTS', 'PAYROLL'],
      createdAt: '2026-02-01T10:00:00Z',
    },
  ] as MockSubCustomer[],
  wallets: [
    {
      id: 'w_usd',
      currency: 'USD',
      balance: '1240.50',
      status: 'ACTIVE' as const,
      businessId: 'biz_finora',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: now(),
    },
    {
      id: 'w_ghs',
      currency: 'GHS',
      balance: '8450.00',
      status: 'ACTIVE' as const,
      businessId: 'biz_finora',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: now(),
    },
    {
      id: 'w_usdt',
      currency: 'USDT',
      balance: '320.00',
      status: 'ACTIVE' as const,
      businessId: 'biz_finora',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: now(),
    },
  ],
  contacts: [
    {
      id: 'c-1',
      name: 'Ama Serwah',
      method: 'ACH',
      identifier: '•••• 4892',
      currency: 'USD',
      favourite: true,
    },
    {
      id: 'c-2',
      name: 'Kwame Mensah',
      method: 'MTN MoMo',
      identifier: '0245550198',
      currency: 'GHS',
      favourite: true,
    },
    {
      id: 'c-9',
      name: 'Ama Boateng',
      method: 'MTN MoMo',
      identifier: '0248891000',
      currency: 'GHS',
      favourite: false,
    },
    {
      id: 'c-3',
      name: 'TechFlow Ltd',
      method: 'FPS',
      identifier: '•••• 0194',
      currency: 'GBP',
      favourite: false,
    },
  ],
  approvals: [
    {
      id: 'apr-1',
      preparationId: 'prep_mcp_ama_500',
      kind: 'payment' as const,
      status: 'pending' as const,
      agent: 'Claude Desktop',
      payload: {
        amount: 500,
        currency: 'USDT',
        recipientName: 'Ama Serwah',
        destinationValue: 'TXk9…7mQ2',
      },
      createdAt: '2026-08-03T11:42:00Z',
    },
    {
      id: 'apr-2',
      preparationId: 'prep_mcp_kwame_200',
      kind: 'momo_disbursement' as const,
      status: 'pending' as const,
      agent: 'ChatGPT',
      payload: {
        amount: 200,
        currency: 'GHS',
        recipientName: 'Kwame Mensah',
        phoneNumber: '0245550198',
        network: 'MTN',
      },
      createdAt: '2026-08-03T10:15:00Z',
    },
  ] as MockApproval[],
  transactions: [
    {
      id: 'tx-1',
      wewireId: 'WW-A1B2C3D4',
      type: 'PAYOUT',
      channel: 'BANK',
      status: 'COMPLETED',
      amount: '250.00',
      currency: 'USD',
      counterparty: 'Ama Serwah',
      reference: 'Rent Aug',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-08-02T09:14:00Z',
      updatedAt: '2026-08-02T09:16:00Z',
    },
    {
      id: 'tx-4',
      wewireId: 'WW-PENDING01',
      type: 'DISBURSEMENT',
      channel: 'MOBILE_MONEY',
      status: 'PROCESSING',
      amount: '3500.00',
      currency: 'GHS',
      counterparty: 'Kwame Mensah',
      reference: 'Invoice 88',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-08-01T15:08:00Z',
      updatedAt: '2026-08-01T15:08:00Z',
    },
  ] as MockTransaction[],
  invoices: [
    {
      id: 'inv-1',
      vendor: 'TechFlow Ltd',
      invoiceNumber: 'INV-1042',
      amount: 780,
      currency: 'GBP',
      dueDate: '2026-08-05T00:00:00Z',
      status: 'due' as const,
      source: 'gmail' as const,
      sourceEmail: {
        from: 'billing@techflow.example',
        subject: 'Invoice INV-1042 from TechFlow Ltd',
        receivedAt: '2026-07-28T11:22:00Z',
        messageId: 'msg-techflow-1042',
      },
    },
    {
      id: 'inv-2',
      vendor: 'ClearView Partners',
      invoiceNumber: 'CV-8891',
      amount: 1500,
      currency: 'GBP',
      dueDate: '2026-08-08T00:00:00Z',
      status: 'due' as const,
      source: 'gmail' as const,
      sourceEmail: {
        from: 'accounts@clearview.example',
        subject: 'ClearView Partners — CV-8891',
        receivedAt: '2026-07-30T09:01:00Z',
        messageId: 'msg-cv-8891',
      },
    },
    {
      id: 'inv-3',
      vendor: 'Cloudflare Inc',
      invoiceNumber: 'CF-22091',
      amount: 80,
      currency: 'USD',
      dueDate: '2026-08-12T00:00:00Z',
      status: 'due' as const,
      source: 'gmail' as const,
      sourceEmail: {
        from: 'invoices@cloudflare.com',
        subject: 'Your Cloudflare invoice CF-22091',
        receivedAt: '2026-08-01T16:40:00Z',
        messageId: 'msg-cf-22091',
      },
    },
  ],
  recurring: [
    {
      id: 'rec-1',
      recipientName: 'TechFlow Ltd',
      amount: 780,
      currency: 'GBP',
      frequency: 'monthly',
      status: 'active',
      nextRunAt: '2026-09-01T09:00:00Z',
      destinationValue: '•••• 0194',
    },
  ] as MockRecurring[],
  kyc: {
    sc_business_001: {
      requirements: [
        { id: 'reg', label: 'Certificate of incorporation', required: true, status: 'uploaded' as const },
        { id: 'addr', label: 'Proof of address', required: true, status: 'missing' as const },
        { id: 'ubo', label: 'Beneficial owners', required: true, status: 'missing' as const },
      ],
      beneficialOwners: [] as { id: string; fullName: string; ownershipPercent: number }[],
    },
  } as Record<
    string,
    {
      requirements: Array<{
        id: string;
        label: string;
        required: boolean;
        status: 'missing' | 'uploaded' | 'verified';
      }>;
      beneficialOwners: Array<{ id: string; fullName: string; ownershipPercent: number }>;
    }
  >,
  fxRates: [
    { from: 'USD', to: 'GHS', rate: 15.5, asOf: now() },
    { from: 'GHS', to: 'USD', rate: 1 / 15.5, asOf: now() },
    { from: 'USD', to: 'EUR', rate: 0.92, asOf: now() },
    { from: 'EUR', to: 'USD', rate: 1 / 0.92, asOf: now() },
    { from: 'USD', to: 'GBP', rate: 0.78, asOf: now() },
    { from: 'GBP', to: 'USD', rate: 1 / 0.78, asOf: now() },
    { from: 'USD', to: 'USDT', rate: 1, asOf: now() },
    { from: 'USDT', to: 'USD', rate: 1, asOf: now() },
  ],
  notifications: [
    {
      id: 'n-1',
      title: 'Approval needed',
      body: 'MCP Agent prepared a $250 payment to Ama Serwah',
      unread: true,
      createdAt: '2026-08-03T10:00:00Z',
    },
    {
      id: 'n-2',
      title: 'Invoice due',
      body: 'TechFlow Ltd INV-1042 is due in 2 days',
      unread: true,
      createdAt: '2026-08-02T08:00:00Z',
    },
  ],
  suppliers: [
    { id: 'sup-1', name: 'TechFlow Ltd', currency: 'GBP', defaultMethod: 'bank' },
    { id: 'sup-2', name: 'ClearView Partners', currency: 'GBP', defaultMethod: 'bank' },
  ],
  employees: [
    { id: 'emp-1', name: 'Ama Boateng', role: 'Designer', salary: 2500, currency: 'USD' },
    { id: 'emp-2', name: 'Kwame Mensah', role: 'Engineer', salary: 3200, currency: 'USD' },
  ],
  policies: [
    {
      id: 'pol-amount',
      name: 'High-value approval',
      rule: 'Amounts over 500 USD require human approval',
      enabled: true,
    },
    {
      id: 'pol-new-recipient',
      name: 'New recipient',
      rule: 'First payment to a new recipient requires approval',
      enabled: true,
    },
  ],
  integrations: [
    { id: 'gmail', name: 'Gmail', status: 'connected' },
    { id: 'calendar', name: 'Google Calendar', status: 'disconnected' },
  ],
  beneficiaries: [
    {
      id: 'ben-1',
      name: 'Ama Serwah',
      method: 'bank',
      identifier: '•••• 0194',
      currency: 'USD',
    },
  ],
  plans: [] as Array<{
    id: string;
    intent: string;
    status: 'draft' | 'pending_approval' | 'approved' | 'executed' | 'cancelled';
    items: Array<Record<string, unknown>>;
    total: number;
    currency: string;
    createdAt: string;
  }>,
  agentTransactions: [] as Array<{
    id: string;
    label?: string;
    status: 'open' | 'committed' | 'rolled_back';
    preparationIds: string[];
    createdAt: string;
    closedAt?: string;
  }>,
  webhooks: [] as Array<{
    id: string;
    url: string;
    eventTypes: string[];
    createdAt: string;
  }>,
  eventSubscriptions: [] as Array<{
    id: string;
    eventTypes: string[];
    createdAt: string;
  }>,
};

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPreparation(kind: MockApproval['kind'], payload: Record<string, unknown>, agent?: string) {
  const preparationId = newId('prep');
  const approval: MockApproval = {
    id: newId('apr'),
    preparationId,
    kind,
    status: 'pending',
    agent: agent ?? 'MCP Agent',
    payload,
    createdAt: now(),
  };
  mockStore.approvals.unshift(approval);
  return {
    status: 'pending_approval' as const,
    preparationId,
    approvalId: approval.id,
    kind,
    payload,
    message:
      'Prepared successfully. Money will not move until a human approves in the Finora app (Approvals inbox).',
  };
}
