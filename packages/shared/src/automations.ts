import { z } from 'zod';

import { CurrencySchema } from './enums';

export const AutomationStatusSchema = z.enum(['active', 'paused', 'disabled']);
export const AutomationTriggerTypeSchema = z.enum([
  'schedule',
  'gmail_invoice',
  'balance_threshold',
  'invoice_due',
]);
export const AutomationActionTypeSchema = z.enum([
  'prepare_payment',
  'prepare_invoice_payment',
  'prepare_supplier_payment',
  'prepare_payroll',
  'prepare_conversion',
  'prepare_internal_transfer',
  'notify_chat',
]);

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm in 24-hour time.');

export const ScheduleTriggerConfigSchema = z
  .object({
    frequency: z.enum(['once', 'daily', 'weekdays', 'weekly', 'monthly']),
    time: TimeSchema,
    timezone: z.string().min(1).default('UTC'),
    date: z.iso.date().optional(),
    weekday: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.frequency === 'once' && !value.date) {
      context.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'A one-time schedule needs a date.',
      });
    }
    if (value.frequency === 'weekly' && value.weekday == null) {
      context.addIssue({
        code: 'custom',
        path: ['weekday'],
        message: 'A weekly schedule needs a weekday.',
      });
    }
    if (value.frequency === 'monthly' && value.dayOfMonth == null) {
      context.addIssue({
        code: 'custom',
        path: ['dayOfMonth'],
        message: 'A monthly schedule needs a day of month.',
      });
    }
  });

export const GmailInvoiceTriggerConfigSchema = z
  .object({
    senderDomains: z.array(z.string().min(1)).max(20).default([]),
    requirePdfAttachment: z.boolean().default(true),
  })
  .strict();

export const BalanceThresholdTriggerConfigSchema = z
  .object({
    walletId: z.string().min(1).optional(),
    currency: CurrencySchema,
    operator: z.enum(['below', 'above']),
    amount: z.number().nonnegative(),
  })
  .strict();

export const InvoiceDueTriggerConfigSchema = z
  .object({
    dueWithinDays: z.number().int().min(0).max(365),
  })
  .strict();

export const AutomationTriggerConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('schedule'), config: ScheduleTriggerConfigSchema }).strict(),
  z.object({ type: z.literal('gmail_invoice'), config: GmailInvoiceTriggerConfigSchema }).strict(),
  z
    .object({ type: z.literal('balance_threshold'), config: BalanceThresholdTriggerConfigSchema })
    .strict(),
  z.object({ type: z.literal('invoice_due'), config: InvoiceDueTriggerConfigSchema }).strict(),
]);

export const AutomationConditionSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('amount_max'),
      amount: z.number().nonnegative(),
      currency: CurrencySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('amount_min'),
      amount: z.number().nonnegative(),
      currency: CurrencySchema,
    })
    .strict(),
  z.object({ type: z.literal('currency_is'), currency: CurrencySchema }).strict(),
  z.object({ type: z.literal('supplier_is'), supplierId: z.string().min(1) }).strict(),
  z.object({ type: z.literal('sender_domain_is'), domain: z.string().min(1) }).strict(),
]);

const NotifyChatActionConfigSchema = z
  .object({
    message: z.string().min(1).max(500),
  })
  .strict();

const PaymentActionConfigSchema = z
  .object({
    recipientId: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    currency: CurrencySchema.optional(),
    purpose: z.string().max(200).optional(),
  })
  .strict();

const ConversionActionConfigSchema = z
  .object({
    fromCurrency: CurrencySchema,
    toCurrency: CurrencySchema,
    amount: z.number().positive().optional(),
    amountMode: z.enum(['fixed', 'threshold_shortfall']).default('fixed'),
  })
  .strict();

const InternalTransferActionConfigSchema = z
  .object({
    sourceWalletId: z.string().min(1),
    destinationWalletId: z.string().min(1),
    currency: CurrencySchema,
    amount: z.number().positive().optional(),
    amountMode: z.enum(['fixed', 'excess_above']),
    retainAmount: z.number().nonnegative().optional(),
  })
  .strict();

export const AutomationActionConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('notify_chat'), config: NotifyChatActionConfigSchema }).strict(),
  z.object({ type: z.literal('prepare_payment'), config: PaymentActionConfigSchema }).strict(),
  z
    .object({ type: z.literal('prepare_invoice_payment'), config: PaymentActionConfigSchema })
    .strict(),
  z
    .object({ type: z.literal('prepare_supplier_payment'), config: PaymentActionConfigSchema })
    .strict(),
  z
    .object({
      type: z.literal('prepare_payroll'),
      config: z.object({ importId: z.string().min(1).optional() }).strict(),
    })
    .strict(),
  z
    .object({ type: z.literal('prepare_conversion'), config: ConversionActionConfigSchema })
    .strict(),
  z
    .object({
      type: z.literal('prepare_internal_transfer'),
      config: InternalTransferActionConfigSchema,
    })
    .strict(),
]);

export const CreateAutomationInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    trigger: AutomationTriggerConfigSchema,
    conditions: z.array(AutomationConditionSchema).max(20).default([]),
    action: AutomationActionConfigSchema,
    status: AutomationStatusSchema.default('active'),
    cooldownSeconds: z.number().int().min(0).max(2_592_000).default(0),
  })
  .strict();

export const UpdateAutomationInputSchema = CreateAutomationInputSchema.partial()
  .extend({ id: z.uuid() })
  .strict();

export const ListAutomationsInputSchema = z
  .object({
    status: AutomationStatusSchema.optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export const TestAutomationInputSchema = z
  .object({
    context: z
      .object({
        amount: z.number().nonnegative().optional(),
        currency: CurrencySchema.optional(),
        supplierId: z.string().optional(),
        senderDomain: z.string().optional(),
        invoiceDueInDays: z.number().int().optional(),
        walletBalance: z.number().nonnegative().optional(),
        now: z.iso.datetime().optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export type AutomationStatus = z.infer<typeof AutomationStatusSchema>;
export type AutomationTrigger = z.infer<typeof AutomationTriggerConfigSchema>;
export type AutomationCondition = z.infer<typeof AutomationConditionSchema>;
export type AutomationAction = z.infer<typeof AutomationActionConfigSchema>;
export type CreateAutomationInput = z.infer<typeof CreateAutomationInputSchema>;
export type UpdateAutomationInput = z.infer<typeof UpdateAutomationInputSchema>;
export type TestAutomationInput = z.infer<typeof TestAutomationInputSchema>;

export type AutomationRecord = CreateAutomationInput & {
  id: string;
  userId: string;
  version: number;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  lastRunStatus: string | null;
  totalRuns: number;
  createdAt: string;
  updatedAt: string;
};
