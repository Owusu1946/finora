import type { RemoteInvoice } from '@finora/shared';

import type { PaymentDestinationKind } from '@/components/chat/PaymentConfirmationCard';
import type { SupportedCurrency } from '@/components/ui/currency-icon';

export type InvoiceStatus = 'due' | 'scheduled' | 'paid' | 'dismissed';
export type InvoiceSource = 'gmail' | 'manual' | 'agent';

export type Invoice = {
  id: string;
  vendor: string;
  invoiceNumber: string;
  amount: number;
  currency: SupportedCurrency | string;
  dueDate: string | null;
  status: InvoiceStatus;
  source: InvoiceSource;
  description?: string;
  destination?: {
    kind: PaymentDestinationKind;
    label: string;
    value: string;
  };
  paidAt?: string;
  transactionId?: string;
};

export function invoiceFromRemote(invoice: RemoteInvoice): Invoice {
  return {
    id: invoice.id,
    vendor: invoice.vendor,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    status: invoice.status,
    source: invoice.source,
    description: invoice.description ?? undefined,
  };
}

export type InvoiceFilter = 'due' | 'paid' | 'scheduled' | 'all';

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    vendor: 'TechFlow Ltd',
    invoiceNumber: 'INV-1042',
    amount: 780,
    currency: 'GBP',
    dueDate: '2026-08-05T00:00:00Z',
    status: 'due',
    source: 'gmail',
    description: 'August cloud hosting',
    destination: {
      kind: 'bank_account',
      label: 'FPS',
      value: '•••• 0194',
    },
  },
  {
    id: 'inv-2',
    vendor: 'ClearView Partners',
    invoiceNumber: 'CV-8891',
    amount: 1500,
    currency: 'GBP',
    dueDate: '2026-08-08T00:00:00Z',
    status: 'due',
    source: 'gmail',
    description: 'Retainer — August',
    destination: {
      kind: 'bank_account',
      label: 'SWIFT',
      value: 'BARCGB22',
    },
  },
  {
    id: 'inv-3',
    vendor: 'Cloudflare Inc',
    invoiceNumber: 'CF-22091',
    amount: 80,
    currency: 'USD',
    dueDate: '2026-08-12T00:00:00Z',
    status: 'due',
    source: 'gmail',
    description: 'Workers usage',
    destination: {
      kind: 'bank_account',
      label: 'ACH',
      value: '****9921',
    },
  },
  {
    id: 'inv-4',
    vendor: 'MTN Business GH',
    invoiceNumber: 'MTN-55102',
    amount: 420,
    currency: 'GHS',
    dueDate: '2026-08-20T00:00:00Z',
    status: 'scheduled',
    source: 'manual',
    description: 'Office data bundle',
    destination: {
      kind: 'mobile_money',
      label: 'MTN MoMo',
      value: '024 111 2200',
    },
  },
  {
    id: 'inv-5',
    vendor: 'Office Supplies Co',
    invoiceNumber: 'OSC-331',
    amount: 210,
    currency: 'USD',
    dueDate: '2026-07-28T00:00:00Z',
    status: 'paid',
    source: 'gmail',
    description: 'Stationery restock',
    paidAt: '2026-07-28T16:40:00Z',
    transactionId: 'WW-PAID3310',
    destination: {
      kind: 'bank_account',
      label: 'ACH',
      value: '****4410',
    },
  },
];
