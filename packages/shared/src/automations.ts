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
    /** Who to pay, in the user's words, e.g. "Kwame, MTN MoMo 0241234567". */
    recipient: z.string().trim().min(1).max(160).optional(),
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

export type AutomationExecutionStatus =
  | 'evaluated'
  | 'skipped_condition'
  | 'prepared_approval'
  | 'notified'
  | 'failed'
  | 'duplicate';

/** One automation run, as the app's activity feed and notifications see it. */
export type AutomationActivityItem = {
  id: string;
  automationId: string;
  automationName: string;
  status: AutomationExecutionStatus;
  summary: string;
  /** The Automations chat the run posted to, when it posted one. */
  chatId: string | null;
  errorCode: string | null;
  createdAt: string;
};

export const AUTOMATIONS_CHAT_TITLE = 'Automations';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(day: number) {
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix}`;
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** "Every Friday at 09:00", "When USD balance drops below USD 10,000", ... */
export function describeAutomationTrigger(trigger: AutomationTrigger) {
  switch (trigger.type) {
    case 'schedule': {
      const { frequency, time, date, weekday, dayOfMonth } = trigger.config;
      if (frequency === 'once') return `On ${date} at ${time}`;
      if (frequency === 'daily') return `Every day at ${time}`;
      if (frequency === 'weekdays') return `Every weekday at ${time}`;
      if (frequency === 'weekly') return `Every ${WEEKDAYS[weekday ?? 1]} at ${time}`;
      return `On the ${ordinal(dayOfMonth ?? 1)} of every month at ${time}`;
    }
    case 'balance_threshold': {
      const { currency, operator, amount } = trigger.config;
      return `When the ${currency} balance goes ${operator} ${money(amount, currency)}`;
    }
    case 'gmail_invoice':
      return trigger.config.senderDomains.length > 0
        ? `When an invoice arrives in Gmail from ${trigger.config.senderDomains.join(', ')}`
        : 'When an invoice arrives in Gmail';
    case 'invoice_due':
      return trigger.config.dueWithinDays === 0
        ? 'When an invoice is due today'
        : `When an invoice is due within ${trigger.config.dueWithinDays} days`;
  }
}

/** What the rule does, e.g. "prepare a USD 500 payment to Kwame for approval". */
export function describeAutomationAction(action: AutomationAction) {
  switch (action.type) {
    case 'notify_chat':
      return `remind you: "${action.config.message}"`;
    case 'prepare_payment':
    case 'prepare_invoice_payment':
    case 'prepare_supplier_payment': {
      const { amount, currency, recipient, purpose } = action.config;
      const what =
        action.type === 'prepare_invoice_payment'
          ? 'an invoice payment'
          : action.type === 'prepare_supplier_payment'
            ? 'a supplier payment'
            : 'a payment';
      const sized = amount && currency ? `${what} of ${money(amount, currency)}` : what;
      return `prepare ${sized}${recipient ? ` to ${recipient}` : ''}${purpose ? ` for ${purpose}` : ''} for your approval`;
    }
    case 'prepare_payroll':
      return 'prepare payroll for your approval';
    case 'prepare_conversion': {
      const { fromCurrency, toCurrency, amount } = action.config;
      return `prepare a conversion of ${amount ? money(amount, fromCurrency) : fromCurrency} to ${toCurrency} for your approval`;
    }
    case 'prepare_internal_transfer':
      return `prepare a ${action.config.currency} transfer between your wallets for your approval`;
  }
}

export function describeAutomation(input: { trigger: AutomationTrigger; action: AutomationAction }) {
  return `${describeAutomationTrigger(input.trigger)}, Finora will ${describeAutomationAction(input.action)}.`;
}

/**
 * What the user sends to Finora when they tap "Prepare it" on a ready
 * automation. Finora then prepares the action through the normal approval flow.
 */
export function automationPreparePrompt(name: string, action: AutomationAction) {
  if (action.type === 'notify_chat') return null;
  if (action.type === 'prepare_payroll') {
    return `Run payroll for my team. This is from my automation "${name}".`;
  }
  if (action.type === 'prepare_conversion') {
    const { fromCurrency, toCurrency, amount } = action.config;
    return `Convert ${amount ? money(amount, fromCurrency) : `some ${fromCurrency}`} to ${toCurrency}. This is from my automation "${name}".`;
  }
  if (action.type === 'prepare_internal_transfer') {
    const { currency, amount } = action.config;
    return `Move ${amount ? money(amount, currency) : `${currency}`} between my wallets. This is from my automation "${name}".`;
  }
  const { amount, currency, recipient, purpose } = action.config;
  const sized = amount && currency ? money(amount, currency) : 'the amount due';
  const to = recipient ? ` to ${recipient}` : '';
  const why = purpose ? ` for ${purpose}` : '';
  const kind = action.type === 'prepare_supplier_payment' ? 'supplier payment' : 'payment';
  return `Prepare a ${kind} of ${sized}${to}${why}. This is from my automation "${name}".`;
}

/** Chat: draft a new automation. The user turns it on from the card. */
export const CreateAutomationToolInputSchema = CreateAutomationInputSchema;

export const ManageAutomationToolInputSchema = z
  .object({
    automationId: z.uuid().optional().describe('Id from list_automations'),
    name: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Automation name, used when the id is unknown'),
    operation: z
      .enum(['pause', 'resume', 'run_now', 'delete'])
      .describe('run_now runs it once immediately; delete asks the user to confirm in the app'),
  })
  .strict();

export const ListAutomationsToolInputSchema = z
  .object({ status: AutomationStatusSchema.optional() })
  .strict();
