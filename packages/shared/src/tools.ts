import { z } from "zod";
import { CurrencySchema, MoneyAmountSchema } from "./money";

/**
 * Financial tool contracts shared by apps/api, apps/mcp, and (later) mobile AI.
 * Money-moving tools prepare work; execution requires a separate approval.
 */

export const GetBalancesInputSchema = z.object({}).strict();

export const SearchContactsInputSchema = z.object({
  query: z.string().min(1),
}).strict();

export const PreparePaymentInputSchema = z.object({
  contactId: z.string().optional(),
  beneficiaryAccountId: z.string().uuid().optional(),
  amount: MoneyAmountSchema,
  reference: z.string().max(140).optional(),
  description: z.string().max(280).optional(),
}).strict();

export const PrepareConversionInputSchema = z.object({
  from: CurrencySchema,
  to: CurrencySchema,
  amount: z.number().positive(),
}).strict();

export const RequestApprovalInputSchema = z.object({
  preparationId: z.string().uuid(),
}).strict();

export const TOOL_NAMES = [
  "get_balances",
  "list_transactions",
  "search_contacts",
  "lookup_account",
  "prepare_payment",
  "prepare_conversion",
  "request_approval",
  "list_virtual_accounts",
  "list_crypto_addresses",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
