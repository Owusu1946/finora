export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly';
export type RecurringStatus = 'active' | 'paused' | 'cancelled';

export type RecurringPayment = {
  id: string;
  recipientName: string;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  nextRunAt: string;
  status: RecurringStatus;
  destination: {
    kind: 'mobile_money' | 'bank_account' | 'crypto_wallet';
    label: string;
    value: string;
  };
  reference?: string;
  createdAt: string;
};

export type RecurringFilter = 'active' | 'paused' | 'all';

export const MOCK_RECURRING: RecurringPayment[] = [
  {
    id: 'rec-1',
    recipientName: 'TechFlow Ltd',
    amount: 780,
    currency: 'GBP',
    frequency: 'monthly',
    nextRunAt: '2026-09-01T09:00:00Z',
    status: 'active',
    destination: {
      kind: 'bank_account',
      label: 'FPS',
      value: '•••• 0194',
    },
    reference: 'Hosting retainer',
    createdAt: '2026-07-01T10:00:00Z',
  },
  {
    id: 'rec-2',
    recipientName: 'Ama Serwah',
    amount: 250,
    currency: 'USD',
    frequency: 'weekly',
    nextRunAt: '2026-08-07T09:00:00Z',
    status: 'active',
    destination: {
      kind: 'bank_account',
      label: 'ACH',
      value: '•••• 4892',
    },
    reference: 'Contractor stipend',
    createdAt: '2026-06-15T12:00:00Z',
  },
  {
    id: 'rec-3',
    recipientName: 'Office Rent GH',
    amount: 4500,
    currency: 'GHS',
    frequency: 'monthly',
    nextRunAt: '2026-08-28T09:00:00Z',
    status: 'paused',
    destination: {
      kind: 'mobile_money',
      label: 'MTN MoMo',
      value: '024 900 1100',
    },
    reference: 'Office rent',
    createdAt: '2026-01-05T08:00:00Z',
  },
];
