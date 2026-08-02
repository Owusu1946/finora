import type { SupportedCurrency } from "@/components/ui/currency-icon";

export type TransactionDirection = "sent" | "received" | "swap";
export type TransactionStatus = "completed" | "pending" | "failed";

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
}

export type ActivityFilter = "all" | "sent" | "received" | "swap";

/**
 * Demo transactions — matches wallet currencies from INITIAL_WALLETS_DATA.
 * Sorted newest-first.
 */
export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    direction: "sent",
    status: "completed",
    currency: "USD",
    amount: 250.0,
    symbol: "$",
    counterparty: "Ama Serwah",
    method: "ACH",
    timestamp: "2026-08-02T09:14:00Z",
  },
  {
    id: "tx-2",
    direction: "received",
    status: "completed",
    currency: "USDT",
    amount: 1200.0,
    symbol: "₮",
    counterparty: "0xA3f…c91D",
    method: "TRC-20",
    timestamp: "2026-08-02T07:42:00Z",
  },
  {
    id: "tx-3",
    direction: "swap",
    status: "completed",
    currency: "EUR",
    amount: 500.0,
    symbol: "€",
    counterparty: "FX Conversion",
    method: "Instant",
    timestamp: "2026-08-01T18:30:00Z",
    toCurrency: "USD",
    toAmount: 545.0,
    toSymbol: "$",
  },
  {
    id: "tx-4",
    direction: "sent",
    status: "pending",
    currency: "GHS",
    amount: 3500.0,
    symbol: "₵",
    counterparty: "Kwame Mensah",
    method: "MTN MoMo",
    timestamp: "2026-08-01T15:08:00Z",
  },
  {
    id: "tx-5",
    direction: "received",
    status: "completed",
    currency: "GBP",
    amount: 780.0,
    symbol: "£",
    counterparty: "TechFlow Ltd",
    method: "FPS",
    timestamp: "2026-08-01T11:20:00Z",
  },
  {
    id: "tx-6",
    direction: "sent",
    status: "failed",
    currency: "USDC",
    amount: 150.0,
    symbol: "$",
    counterparty: "4sK9…mP2x",
    method: "Solana",
    timestamp: "2026-07-31T22:55:00Z",
  },
  {
    id: "tx-7",
    direction: "received",
    status: "completed",
    currency: "USD",
    amount: 4200.0,
    symbol: "$",
    counterparty: "Invoice #1042",
    method: "Wire",
    timestamp: "2026-07-31T14:00:00Z",
  },
  {
    id: "tx-8",
    direction: "swap",
    status: "completed",
    currency: "GHS",
    amount: 8000.0,
    symbol: "₵",
    counterparty: "FX Conversion",
    method: "Instant",
    timestamp: "2026-07-30T09:45:00Z",
    toCurrency: "USDT",
    toAmount: 520.0,
    toSymbol: "₮",
  },
  {
    id: "tx-9",
    direction: "sent",
    status: "completed",
    currency: "EUR",
    amount: 120.0,
    symbol: "€",
    counterparty: "Maria García",
    method: "SEPA",
    timestamp: "2026-07-30T08:12:00Z",
  },
  {
    id: "tx-10",
    direction: "received",
    status: "completed",
    currency: "USDT",
    amount: 800.0,
    symbol: "₮",
    counterparty: "0x7Bf…e42A",
    method: "ERC-20",
    timestamp: "2026-07-29T16:33:00Z",
  },
  {
    id: "tx-11",
    direction: "sent",
    status: "completed",
    currency: "USD",
    amount: 65.0,
    symbol: "$",
    counterparty: "Abena Owusu",
    method: "ACH",
    timestamp: "2026-07-29T10:05:00Z",
  },
  {
    id: "tx-12",
    direction: "received",
    status: "pending",
    currency: "GBP",
    amount: 1500.0,
    symbol: "£",
    counterparty: "ClearView Partners",
    method: "SWIFT",
    timestamp: "2026-07-28T13:18:00Z",
  },
];
