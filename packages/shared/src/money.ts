import { z } from "zod";

/** Currencies Finora surfaces in product (subset may depend on WeWire config). */
export const CurrencySchema = z.enum(["USD", "EUR", "GBP", "GHS", "USDT", "USDC"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const MoneyAmountSchema = z.object({
  amount: z.number().positive(),
  currency: CurrencySchema,
});
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
  "executed",
  "failed",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
