import { z } from 'zod';

/**
 * The demo ledger: Finora's record of what is in each wallet and every money
 * movement. It is the source of truth for the app, chat, automations, and MCP.
 * Everything is `mode: demo` until WeWire rails are live.
 */

/** Approximate USD per unit, used for demo conversions until live FX is wired in. */
export const DEMO_FX_USD_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.09,
  GBP: 1.28,
  USDT: 1.0,
  USDC: 1.0,
  GHS: 0.065,
  NGN: 0.00065,
  KES: 0.0077,
  ZAR: 0.055,
  UGX: 0.00027,
  TZS: 0.00037,
  XOF: 0.0016,
  XAF: 0.0016,
};

/** Demo conversion fee on FX between wallets. */
export const DEMO_CONVERSION_FEE_RATE = 0.004;

/** `amount` in `from`, expressed in `to` at the demo rates. */
export function convertDemoAmount(amount: number, from: string, to: string) {
  if (from === to) return amount;
  return (amount * (DEMO_FX_USD_RATES[from] ?? 1)) / (DEMO_FX_USD_RATES[to] ?? 1);
}

/** Wallets a new account starts with, before the app copies its own balances. */
export const DEMO_STARTING_WALLETS = [
  { id: 'w-usd', currency: 'USD', balance: 6420.5 },
  { id: 'w-usdt', currency: 'USDT', balance: 3200 },
  { id: 'w-eur', currency: 'EUR', balance: 2150 },
  { id: 'w-usdc', currency: 'USDC', balance: 1500 },
  { id: 'w-gbp', currency: 'GBP', balance: 1480 },
  { id: 'w-ghs', currency: 'GHS', balance: 18500 },
] as const;

export const LedgerWalletSchema = z.object({
  /** Stable wallet key, e.g. `w-usd`. */
  id: z.string().min(1).max(40),
  currency: z.string().min(3).max(12),
  balance: z.number(),
  usdEquivalent: z.number(),
});
export type LedgerWallet = z.infer<typeof LedgerWalletSchema>;

export const LedgerWalletsResponseSchema = z.object({
  mode: z.literal('demo'),
  /** False until the app has copied its balances (or the starting balances were used). */
  initialized: z.boolean(),
  wallets: z.array(LedgerWalletSchema),
  totalUsd: z.number(),
});
export type LedgerWalletsResponse = z.infer<typeof LedgerWalletsResponseSchema>;

export const LedgerTransactionDirectionSchema = z.enum(['sent', 'received', 'swap']);
export const LedgerTransactionStatusSchema = z.enum(['completed', 'pending', 'failed']);
export const LedgerTransactionSourceSchema = z.enum(['chat', 'mcp', 'manual', 'automation']);

export const LedgerTransactionSchema = z.object({
  id: z.string().min(1),
  direction: LedgerTransactionDirectionSchema,
  status: LedgerTransactionStatusSchema,
  currency: z.string(),
  amount: z.number(),
  toCurrency: z.string().nullable(),
  toAmount: z.number().nullable(),
  fee: z.number().nullable(),
  counterparty: z.string(),
  method: z.string(),
  reference: z.string().nullable(),
  /** Masked: only the last four characters. */
  destination: z.string().nullable(),
  source: LedgerTransactionSourceSchema,
  /** What created it, e.g. `payment`, `payroll_run`, `card_funding`. */
  kind: z.string(),
  mode: z.literal('demo'),
  createdAt: z.string(),
});
export type LedgerTransaction = z.infer<typeof LedgerTransactionSchema>;

export const LedgerTransactionsResponseSchema = z.object({
  transactions: z.array(LedgerTransactionSchema),
});

export const LedgerTransactionResponseSchema = z.object({
  transaction: LedgerTransactionSchema,
});

/** History the app kept on the device before the ledger existed. */
export const ImportedTransactionSchema = z.object({
  id: z.string().min(1).max(120),
  direction: LedgerTransactionDirectionSchema,
  status: LedgerTransactionStatusSchema,
  currency: z.string().min(3).max(12),
  amount: z.number().nonnegative(),
  toCurrency: z.string().min(3).max(12).optional(),
  toAmount: z.number().nonnegative().optional(),
  fee: z.number().nonnegative().optional(),
  counterparty: z.string().max(200),
  method: z.string().max(80),
  reference: z.string().max(280).optional(),
  destination: z.string().max(120).optional(),
  source: LedgerTransactionSourceSchema.optional(),
  timestamp: z.string().datetime({ offset: true }),
});

/** One-time copy of the app's demo balances and history to the ledger. */
export const ImportWalletsRequestSchema = z
  .object({
    wallets: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          currency: z.string().min(3).max(12),
          balance: z.number().nonnegative().max(1_000_000_000),
        }),
      )
      .min(1)
      .max(30),
    transactions: z.array(ImportedTransactionSchema).max(500).default([]),
  })
  .strict();
export type ImportWalletsRequest = z.input<typeof ImportWalletsRequestSchema>;

/** A demo top-up (bank, mobile money, or crypto deposit), approved with the passcode. */
export const FundWalletRequestSchema = z
  .object({
    amount: z.number().positive().max(1_000_000),
    method: z.string().trim().min(1).max(80),
    counterparty: z.string().trim().max(120).optional(),
    reference: z.string().trim().max(140).optional(),
  })
  .strict();
export type FundWalletRequest = z.infer<typeof FundWalletRequestSchema>;

export const ListLedgerTransactionsInputSchema = z
  .object({
    query: z.string().trim().max(80).optional().describe('Counterparty or reference to search'),
    direction: LedgerTransactionDirectionSchema.optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();
