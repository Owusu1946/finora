import { z } from 'zod';

/** Cards are issued in USD; the issuing program does not support other currencies. */
export const VirtualCardCurrencySchema = z.literal('USD');
export const VirtualCardStatusSchema = z.enum(['active', 'frozen', 'cancelled']);
export type VirtualCardStatus = z.infer<typeof VirtualCardStatusSchema>;
export const VirtualCardNetworkSchema = z.enum(['visa', 'mastercard']);
export type VirtualCardNetwork = z.infer<typeof VirtualCardNetworkSchema>;

/** Largest lifetime spend limit a user can set, in USD. */
export const MAX_VIRTUAL_CARD_LIMIT = 10_000;

/**
 * Flat fee charged to the funding account each time a card is issued, in USD.
 * Cards are prepaid: the funded amount becomes the card's lifetime spend limit.
 */
export const VIRTUAL_CARD_ISSUE_FEE_USD = 1;

/**
 * A virtual card as the app sees it. Amounts are in USD (major units).
 * `pan`, `cvv`, and `expiry` come live from the issuer on each request and are
 * never stored by Finora.
 */
export const VirtualCardSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  last4: z.string().length(4),
  network: VirtualCardNetworkSchema,
  currency: VirtualCardCurrencySchema,
  status: VirtualCardStatusSchema,
  spendLimit: z.number().nonnegative(),
  spent: z.number().nonnegative(),
  createdAt: z.iso.datetime(),
  pan: z.string(),
  expiry: z.string(),
  cvv: z.string(),
});
export type VirtualCardRecord = z.infer<typeof VirtualCardSchema>;

export const VirtualCardListResponseSchema = z.object({ cards: z.array(VirtualCardSchema) });
export const VirtualCardResponseSchema = z.object({ card: VirtualCardSchema });

export const CreateVirtualCardRequestSchema = z.object({
  label: z.string().trim().min(1).max(40),
  spendLimit: z.number().positive().max(MAX_VIRTUAL_CARD_LIMIT),
  currency: VirtualCardCurrencySchema.default('USD'),
  /** The wallet charged for the load plus the issue fee. */
  fundingWalletId: z.string().min(1).max(40),
});
export type CreateVirtualCardRequest = z.infer<typeof CreateVirtualCardRequestSchema>;

export const UpdateVirtualCardRequestSchema = z
  .object({
    label: z.string().trim().min(1).max(40).optional(),
    spendLimit: z.number().positive().max(MAX_VIRTUAL_CARD_LIMIT).optional(),
    status: VirtualCardStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one card field is required.',
  });
export type UpdateVirtualCardRequest = z.infer<typeof UpdateVirtualCardRequestSchema>;

/** Add `amount` USD to a prepaid card's balance (its lifetime spend limit). */
export const TopUpVirtualCardRequestSchema = z.object({
  amount: z.number().positive().max(MAX_VIRTUAL_CARD_LIMIT),
  /** The wallet charged for the top-up plus the fee. */
  fundingWalletId: z.string().min(1).max(40),
});
export type TopUpVirtualCardRequest = z.infer<typeof TopUpVirtualCardRequestSchema>;

/**
 * A purchase or refund on a card. `deducted` is what it took off the card's
 * balance in USD: positive for purchases, negative for refunds, and 0 for
 * declined or reversed transactions.
 */
export const CardTransactionSchema = z.object({
  id: z.string().min(1),
  merchant: z.string(),
  location: z.string().nullable(),
  kind: z.enum(['purchase', 'refund']),
  state: z.enum(['pending', 'completed', 'declined', 'reversed']),
  amount: z.number(),
  deducted: z.number(),
  merchantAmount: z.number(),
  merchantCurrency: z.string(),
  createdAt: z.iso.datetime(),
});
export type CardTransaction = z.infer<typeof CardTransactionSchema>;

export const CardTransactionListResponseSchema = z.object({
  transactions: z.array(CardTransactionSchema),
});

/** Chat tool: open card setup in the app (the app picks funding and confirms). */
export const CreateVirtualCardToolInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .optional()
    .describe('Short name for what the card pays for, e.g. "Netflix" or "Subscription"'),
  spendLimit: z
    .number()
    .positive()
    .max(MAX_VIRTUAL_CARD_LIMIT)
    .optional()
    .describe(
      'USD amount to load onto the prepaid card. Always set it when the user mentions any amount, e.g. "my $20 sub" -> 20.',
    ),
});

export const ListVirtualCardsToolInputSchema = z.object({
  status: z.enum(['active', 'frozen', 'all']).optional(),
});

export const GetVirtualCardToolInputSchema = z.object({
  cardId: z.string().min(1).optional(),
  label: z.string().trim().min(1).optional().describe('Card label to look up, e.g. Netflix'),
});
