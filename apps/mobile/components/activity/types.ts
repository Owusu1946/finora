import type { SupportedCurrency } from '@/components/ui/currency-icon';

export type TransactionDirection = 'sent' | 'received' | 'swap';
export type TransactionStatus = 'completed' | 'pending' | 'failed';

export type TimelineStepStatus = 'done' | 'active' | 'upcoming' | 'failed';

export type TransactionTimelineStep = {
  id: string;
  label: string;
  at?: string;
  status: TimelineStepStatus;
};

export interface Transaction {
  id: string;
  direction: TransactionDirection;
  status: TransactionStatus;
  currency: SupportedCurrency;
  amount: number;
  symbol: string;
  /** Counterparty name or address */
  counterparty: string;
  /** Method badge, e.g. "ACH", "TRC-20", "MTN MoMo" */
  method: string;
  /** ISO timestamp */
  timestamp: string;
  /** For swaps: the target currency */
  toCurrency?: SupportedCurrency;
  toAmount?: number;
  toSymbol?: string;
  /** WeWire reference shown on rails */
  wewireId?: string;
  /** Finora preparation / ledger id */
  finoraId?: string;
  /** Rail label (often same as method) */
  rail?: string;
  fee?: number;
  feeCurrency?: string;
  reference?: string;
  /** Where the payment originated */
  source?: 'chat' | 'mcp' | 'manual' | 'automation';
  destinationValue?: string;
  timeline?: TransactionTimelineStep[];
}

export type ActivityFilter = 'all' | 'sent' | 'received' | 'swap';

const SYMBOL: Partial<Record<SupportedCurrency, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  GHS: '₵',
  USDT: '₮',
  USDC: '$',
  NGN: '₦',
  CAD: 'C$',
  KES: 'KSh',
};

export function currencySymbol(currency: string): string {
  return SYMBOL[currency as SupportedCurrency] ?? currency;
}

/** Build a status timeline for detail screens. */
export function buildTransactionTimeline(
  status: TransactionStatus,
  timestamp: string,
): TransactionTimelineStep[] {
  const t = new Date(timestamp).getTime();
  const at = (offsetMs: number) => new Date(t + offsetMs).toISOString();

  if (status === 'pending') {
    return [
      { id: 'prepared', label: 'Prepared', at: at(-180_000), status: 'done' },
      { id: 'approved', label: 'Approved', at: at(-90_000), status: 'done' },
      { id: 'submitted', label: 'Submitted to rails', at: at(-30_000), status: 'active' },
      { id: 'settled', label: 'Settled', status: 'upcoming' },
    ];
  }

  if (status === 'failed') {
    return [
      { id: 'prepared', label: 'Prepared', at: at(-180_000), status: 'done' },
      { id: 'approved', label: 'Approved', at: at(-120_000), status: 'done' },
      { id: 'submitted', label: 'Submitted to rails', at: at(-60_000), status: 'done' },
      { id: 'settled', label: 'Failed', at: timestamp, status: 'failed' },
    ];
  }

  return [
    { id: 'prepared', label: 'Prepared', at: at(-180_000), status: 'done' },
    { id: 'approved', label: 'Approved', at: at(-120_000), status: 'done' },
    { id: 'submitted', label: 'Submitted to rails', at: at(-60_000), status: 'done' },
    { id: 'settled', label: 'Settled', at: timestamp, status: 'done' },
  ];
}
