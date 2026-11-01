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
