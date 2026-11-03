import { z } from 'zod';

/**
 * Saved payees (contacts and suppliers) and approval policies, stored on the
 * Finora API so the app, chat, and MCP see the same recipients and rules.
 */

export const PayeeKindSchema = z.enum(['contact', 'supplier']);
export type PayeeKind = z.infer<typeof PayeeKindSchema>;

export const PayeeMethodSchema = z.enum([
  'bank_account',
  'mobile_money',
  'crypto_wallet',
  'finora',
]);
export type PayeeMethod = z.infer<typeof PayeeMethodSchema>;

export const PayeeSchema = z.object({
  id: z.string(),
  kind: PayeeKindSchema,
  name: z.string(),
  currency: z.string(),
  method: PayeeMethodSchema,
  /** Network or bank, e.g. "MTN MoMo" or "Barclays · FPS". */
  label: z.string(),
  /** Account number, phone, address, or Finora tag. Only the owner sees it in full. */
  identifier: z.string(),
  country: z.string().nullable(),
  defaultAmount: z.number().nullable(),
  notes: z.string().nullable(),
  favourite: z.boolean(),
  lastPaidAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Payee = z.infer<typeof PayeeSchema>;

export const SavePayeeRequestSchema = z
  .object({
    kind: PayeeKindSchema,
    name: z.string().trim().min(1).max(120),
    currency: z.string().trim().min(3).max(12),
    method: PayeeMethodSchema,
    label: z.string().trim().min(1).max(80),
    identifier: z.string().trim().min(1).max(120),
    country: z.string().trim().length(2).optional(),
    defaultAmount: z.number().positive().max(100_000_000).optional(),
    notes: z.string().trim().max(280).optional(),
    favourite: z.boolean().optional(),
  })
  .strict();
export type SavePayeeRequest = z.infer<typeof SavePayeeRequestSchema>;

export const UpdatePayeeRequestSchema = SavePayeeRequestSchema.omit({ kind: true })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Change at least one field.',
  });
export type UpdatePayeeRequest = z.infer<typeof UpdatePayeeRequestSchema>;

/** One-time copy of the contacts the app saved before payees lived on the API. */
export const ImportPayeesRequestSchema = z
  .object({ payees: z.array(SavePayeeRequestSchema).max(200) })
  .strict();

export const PayeeResponseSchema = z.object({ payee: PayeeSchema });
export const PayeeListResponseSchema = z.object({ payees: z.array(PayeeSchema) });

export const ListPayeesInputSchema = z
  .object({
    kind: PayeeKindSchema.optional(),
    query: z.string().trim().max(80).optional().describe('Name, network, or account to match'),
  })
  .strict();

export const SavePayeeToolInputSchema = SavePayeeRequestSchema;

export const ApprovalPolicyKindSchema = z.enum(['amount_review', 'new_recipient', 'daily_limit']);
export type ApprovalPolicyKind = z.infer<typeof ApprovalPolicyKindSchema>;

export const ApprovalPolicySchema = z.object({
  id: z.string(),
  kind: ApprovalPolicyKindSchema,
  name: z.string(),
  /** What the rule does, in words. */
  rule: z.string(),
  enabled: z.boolean(),
  /** USD threshold for amount and daily rules. */
  amountUsd: z.number().nullable(),
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const ApprovalPolicyListResponseSchema = z.object({
  policies: z.array(ApprovalPolicySchema),
});
export const ApprovalPolicyResponseSchema = z.object({ policy: ApprovalPolicySchema });

export const UpdateApprovalPolicyRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    amountUsd: z.number().positive().max(10_000_000).optional(),
  })
  .strict()
  .refine((value) => value.enabled !== undefined || value.amountUsd !== undefined, {
    message: 'Change at least one field.',
  });
export type UpdateApprovalPolicyRequest = z.infer<typeof UpdateApprovalPolicyRequestSchema>;
