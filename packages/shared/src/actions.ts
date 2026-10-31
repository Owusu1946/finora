import { z } from 'zod';

/**
 * Prepared actions: every money movement outside payroll and cards. Chat, the
 * app, automations, and MCP prepare one; it executes only after the user
 * approves it in the app with their passcode, against the demo ledger.
 */

export const PreparedActionKindSchema = z.enum(['payment', 'conversion', 'plan']);
export type PreparedActionKind = z.infer<typeof PreparedActionKindSchema>;

export const PreparedActionStatusSchema = z.enum([
  'pending_approval',
  'executed',
  'cancelled',
  'failed',
]);
export type PreparedActionStatus = z.infer<typeof PreparedActionStatusSchema>;

export const PreparedActionSourceSchema = z.enum(['chat', 'manual', 'automation', 'mcp']);
export type PreparedActionSource = z.infer<typeof PreparedActionSourceSchema>;

/** What a payment is for; it changes how it reads in Activity, not how it moves. */
export const PaymentPurposeSchema = z.enum(['payment', 'supplier', 'invoice', 'bill', 'transfer']);

const currency = z.string().trim().min(3).max(12);
const amount = z.number().positive().max(100_000_000);

export const ActionDestinationSchema = z.object({
  kind: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().max(120),
});

export const PaymentActionInputSchema = z
  .object({
    kind: z.literal('payment'),
    recipientName: z.string().trim().min(1).max(120),
    amount,
    currency,
    destination: ActionDestinationSchema,
    reference: z.string().trim().max(140).optional(),
    purpose: PaymentPurposeSchema.default('payment'),
    /** The invoice, supplier, or bill being paid, when there is one. */
    relatedId: z.string().trim().max(120).optional(),
    /** Wallet to pay from; defaults to the wallet in the payment's currency. */
    fundingWalletId: z.string().min(1).max(40).optional(),
  })
  .strict();

export const ConversionActionInputSchema = z
  .object({
    kind: z.literal('conversion'),
    from: currency,
    to: currency,
    amount,
  })
  .strict()
  .refine((input) => input.from.toUpperCase() !== input.to.toUpperCase(), {
    message: 'Pick two different currencies.',
  });

export const PlanActionItemSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    amount,
    category: z.string().trim().max(40).optional(),
  })
  .strict();

export const PlanActionInputSchema = z
  .object({
    kind: z.literal('plan'),
    title: z.string().trim().min(1).max(120),
    currency,
    items: z.array(PlanActionItemSchema).min(1).max(50),
    fundingWalletId: z.string().min(1).max(40).optional(),
  })
  .strict();

export const PrepareActionRequestSchema = z.union([
  PaymentActionInputSchema,
  ConversionActionInputSchema,
  PlanActionInputSchema,
]);
export type PrepareActionRequest = z.input<typeof PrepareActionRequestSchema>;
export type PaymentActionInput = z.infer<typeof PaymentActionInputSchema>;
export type ConversionActionInput = z.infer<typeof ConversionActionInputSchema>;
export type PlanActionInput = z.infer<typeof PlanActionInputSchema>;

export const PolicyOutcomeSchema = z.enum(['allowed', 'needs_review', 'blocked']);
export const PolicyResultSchema = z.object({
  outcome: PolicyOutcomeSchema,
  reasons: z.array(z.string()),
});
export type PolicyResult = z.infer<typeof PolicyResultSchema>;

export const PreparedActionSchema = z.object({
  id: z.string(),
  kind: PreparedActionKindSchema,
  status: PreparedActionStatusSchema,
  source: PreparedActionSourceSchema,
  mode: z.literal('demo'),
  /** Who or what it pays, e.g. "Ama Mensah" or "USD → GHS". */
  title: z.string(),
  amount: z.number(),
  currency: z.string(),
  fee: z.number(),
  /** Payments: who gets it, with the destination masked. */
  recipient: z
    .object({
      name: z.string(),
      destination: ActionDestinationSchema,
      purpose: PaymentPurposeSchema,
      relatedId: z.string().nullable(),
    })
    .nullable(),
  /** Conversions: what the user gets. */
  conversion: z
    .object({ from: z.string(), to: z.string(), toAmount: z.number(), rate: z.number() })
    .nullable(),
  /** Plans: the line items. */
  items: z.array(PlanActionItemSchema),
  reference: z.string().nullable(),
  /** The wallet it is paid from and what it takes from it, in that wallet's currency. */
  funding: z.object({ walletId: z.string(), currency: z.string(), amount: z.number() }).nullable(),
  policy: PolicyResultSchema,
  transactionId: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  executedAt: z.string().nullable(),
});
export type PreparedAction = z.infer<typeof PreparedActionSchema>;

export const PreparedActionResponseSchema = z.object({ action: PreparedActionSchema });
export const PreparedActionListResponseSchema = z.object({
  actions: z.array(PreparedActionSchema),
});

export const ExecuteActionRequestSchema = z
  .object({
    /** Overrides the wallet chosen at prepare time. */
    fundingWalletId: z.string().min(1).max(40).optional(),
  })
  .strict();
export type ExecuteActionRequest = z.infer<typeof ExecuteActionRequestSchema>;
