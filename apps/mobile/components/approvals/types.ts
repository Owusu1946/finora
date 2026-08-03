import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type FinancialPlanItemKind =
  | 'payroll'
  | 'invoice'
  | 'supplier'
  | 'payment'
  | 'conversion'
  | 'recurring';

export type FinancialPlanItem = {
  kind: FinancialPlanItemKind;
  label: string;
  amount: number;
  currency: string;
  refId?: string;
};

export type FinancialPlanPayload = {
  planId: string;
  intent: string;
  currency: string;
  total: number;
  items: FinancialPlanItem[];
};

export type ApprovalRequest = {
  id: string;
  /** Single payout vs multi-item financial plan */
  kind: 'payment' | 'plan';
  status: ApprovalStatus;
  /** Agent / client that prepared the payment */
  agent: string;
  createdAt: string;
  resolvedAt?: string;
  preparationId: string;
  /** Present when kind === 'payment' */
  payment?: PaymentConfirmation;
  /** Present when kind === 'plan' */
  plan?: FinancialPlanPayload;
  transactionId?: string;
};

export type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all';

/** Business-first demo plan — payroll + rent + invoices/suppliers. */
export const MOCK_BUSINESS_PLAN: FinancialPlanPayload = {
  planId: 'plan_due_today_001',
  intent: 'Pay everything due today',
  currency: 'USD',
  total: 8230,
  items: [
    {
      kind: 'payroll',
      label: 'Payroll · Ama Boateng, Kwame Mensah',
      amount: 5700,
      currency: 'USD',
    },
    {
      kind: 'payment',
      label: 'Office rent',
      amount: 250,
      currency: 'USD',
    },
    {
      kind: 'invoice',
      label: 'TechFlow Ltd · INV-1042',
      amount: 780,
      currency: 'GBP',
      refId: 'inv-1',
    },
    {
      kind: 'supplier',
      label: 'ClearView Partners',
      amount: 1500,
      currency: 'GBP',
      refId: 'sup-2',
    },
  ],
};

export const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: 'apr-plan-1',
    kind: 'plan',
    status: 'pending',
    agent: 'Claude Desktop',
    createdAt: '2026-08-03T12:05:00Z',
    preparationId: 'prep_plan_due_today',
    plan: MOCK_BUSINESS_PLAN,
  },
  {
    id: 'apr-1',
    kind: 'payment',
    status: 'pending',
    agent: 'Claude Desktop',
    createdAt: '2026-08-03T11:42:00Z',
    preparationId: 'prep_mcp_ama_500',
    payment: {
      amount: 500,
      currency: 'USDT',
      recipientName: 'Ama Serwah',
      destination: {
        kind: 'crypto_wallet',
        label: 'USDT · TRC-20',
        value: 'TXk9…7mQ2',
      },
      reference: 'Pay Ama 500 USDT',
    },
  },
  {
    id: 'apr-2',
    kind: 'payment',
    status: 'pending',
    agent: 'ChatGPT',
    createdAt: '2026-08-03T10:15:00Z',
    preparationId: 'prep_mcp_kwame_200',
    payment: {
      amount: 200,
      currency: 'GHS',
      recipientName: 'Kwame Mensah',
      destination: {
        kind: 'mobile_money',
        label: 'MTN MoMo',
        value: '024 555 0198',
      },
      reference: 'Weekend float',
    },
  },
  {
    id: 'apr-3',
    kind: 'payment',
    status: 'pending',
    agent: 'Cursor',
    createdAt: '2026-08-02T18:05:00Z',
    preparationId: 'prep_mcp_vendor_80',
    payment: {
      amount: 80,
      currency: 'USD',
      recipientName: 'Cloudflare Inc',
      destination: {
        kind: 'bank_account',
        label: 'ACH',
        value: '****9921',
      },
      reference: 'Workers invoice',
    },
  },
  {
    id: 'apr-4',
    kind: 'payment',
    status: 'approved',
    agent: 'Claude Desktop',
    createdAt: '2026-08-01T09:20:00Z',
    resolvedAt: '2026-08-01T09:22:00Z',
    preparationId: 'prep_mcp_maria_120',
    transactionId: 'WW-A1B2C3D4',
    payment: {
      amount: 120,
      currency: 'EUR',
      recipientName: 'Maria García',
      destination: {
        kind: 'bank_account',
        label: 'SEPA',
        value: 'ES91 **** 4509',
      },
    },
  },
  {
    id: 'apr-5',
    kind: 'payment',
    status: 'rejected',
    agent: 'ChatGPT',
    createdAt: '2026-07-30T14:10:00Z',
    resolvedAt: '2026-07-30T14:11:00Z',
    preparationId: 'prep_mcp_reject_demo',
    payment: {
      amount: 2500,
      currency: 'USD',
      recipientName: 'Unknown Vendor',
      destination: {
        kind: 'bank_account',
        label: 'Wire',
        value: '****0000',
      },
      reference: 'Flagged amount',
    },
  },
];
