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
