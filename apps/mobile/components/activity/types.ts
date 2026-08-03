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
  source?: 'chat' | 'mcp' | 'manual';
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

function withDetail(tx: Transaction): Transaction {
  const wewireId =
    tx.wewireId ??
    `WW-${tx.id.replace(/\D/g, '').padStart(8, '0').slice(-8).toUpperCase() || '00000001'}`;
  return {
    ...tx,
    wewireId,
    finoraId: tx.finoraId ?? `fin_${tx.id}`,
    rail: tx.rail ?? tx.method,
    timeline: tx.timeline ?? buildTransactionTimeline(tx.status, tx.timestamp),
  };
}

/**
 * Demo transactions — matches wallet currencies from INITIAL_WALLETS_DATA.
 * Sorted newest-first.
 */
const MOCK_TRANSACTIONS_RAW: Transaction[] = [
  {
    id: 'tx-1',
    direction: 'sent',
    status: 'completed',
    currency: 'USD',
    amount: 250.0,
    symbol: '$',
    counterparty: 'Ama Serwah',
    method: 'ACH',
    timestamp: '2026-08-02T09:14:00Z',
    destinationValue: '****4821',
    source: 'chat',
    fee: 0.5,
    feeCurrency: 'USD',
    reference: 'Rent Aug',
  },
  {
    id: 'tx-2',
    direction: 'received',
    status: 'completed',
    currency: 'USDT',
    amount: 1200.0,
    symbol: '₮',
    counterparty: '0xA3f…c91D',
    method: 'TRC-20',
    timestamp: '2026-08-02T07:42:00Z',
    destinationValue: '0xA3f7…c91D',
    source: 'manual',
  },
  {
    id: 'tx-3',
    direction: 'swap',
    status: 'completed',
    currency: 'EUR',
    amount: 500.0,
    symbol: '€',
    counterparty: 'FX Conversion',
    method: 'Instant',
    timestamp: '2026-08-01T18:30:00Z',
    toCurrency: 'USD',
    toAmount: 545.0,
    toSymbol: '$',
    source: 'chat',
  },
  {
    id: 'tx-4',
    direction: 'sent',
    status: 'pending',
    currency: 'GHS',
    amount: 3500.0,
    symbol: '₵',
    counterparty: 'Kwame Mensah',
    method: 'MTN MoMo',
    timestamp: '2026-08-01T15:08:00Z',
    destinationValue: '024 555 0198',
    source: 'mcp',
    reference: 'Invoice 88',
  },
  {
    id: 'tx-5',
    direction: 'received',
    status: 'completed',
    currency: 'GBP',
    amount: 780.0,
    symbol: '£',
    counterparty: 'TechFlow Ltd',
    method: 'FPS',
    timestamp: '2026-08-01T11:20:00Z',
    source: 'manual',
  },
  {
    id: 'tx-6',
    direction: 'sent',
    status: 'failed',
    currency: 'USDC',
    amount: 150.0,
    symbol: '$',
    counterparty: '4sK9…mP2x',
    method: 'Solana',
    timestamp: '2026-07-31T22:55:00Z',
    destinationValue: '4sK9…mP2x',
    source: 'chat',
  },
  {
    id: 'tx-7',
    direction: 'received',
    status: 'completed',
    currency: 'USD',
    amount: 4200.0,
    symbol: '$',
    counterparty: 'Invoice #1042',
    method: 'Wire',
    timestamp: '2026-07-31T14:00:00Z',
    source: 'manual',
  },
  {
    id: 'tx-8',
    direction: 'swap',
    status: 'completed',
    currency: 'GHS',
    amount: 8000.0,
    symbol: '₵',
    counterparty: 'FX Conversion',
    method: 'Instant',
    timestamp: '2026-07-30T09:45:00Z',
    toCurrency: 'USDT',
    toAmount: 520.0,
    toSymbol: '₮',
    source: 'chat',
  },
  {
    id: 'tx-9',
    direction: 'sent',
    status: 'completed',
    currency: 'EUR',
    amount: 120.0,
    symbol: '€',
    counterparty: 'Maria García',
    method: 'SEPA',
    timestamp: '2026-07-30T08:12:00Z',
    destinationValue: 'ES91 **** 4509',
    source: 'mcp',
    wewireId: 'WW-A1B2C3D4',
  },
  {
    id: 'tx-10',
    direction: 'received',
    status: 'completed',
    currency: 'USDT',
    amount: 800.0,
    symbol: '₮',
    counterparty: '0x7Bf…e42A',
    method: 'ERC-20',
    timestamp: '2026-07-29T16:33:00Z',
    source: 'manual',
  },
  {
    id: 'tx-11',
    direction: 'sent',
    status: 'completed',
    currency: 'USD',
    amount: 65.0,
    symbol: '$',
    counterparty: 'Abena Owusu',
    method: 'ACH',
    timestamp: '2026-07-29T10:05:00Z',
    source: 'chat',
  },
  {
    id: 'tx-12',
    direction: 'received',
    status: 'pending',
    currency: 'GBP',
    amount: 1500.0,
    symbol: '£',
    counterparty: 'ClearView Partners',
    method: 'SWIFT',
    timestamp: '2026-07-28T13:18:00Z',
    source: 'manual',
  },
];

export const MOCK_TRANSACTIONS: Transaction[] = MOCK_TRANSACTIONS_RAW.map(withDetail);
