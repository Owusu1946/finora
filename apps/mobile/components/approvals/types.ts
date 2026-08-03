import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalRequest = {
  id: string;
  status: ApprovalStatus;
  /** Agent / client that prepared the payment */
  agent: string;
  createdAt: string;
  resolvedAt?: string;
  preparationId: string;
  payment: PaymentConfirmation;
  transactionId?: string;
};

export type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all';

export const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: 'apr-1',
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
