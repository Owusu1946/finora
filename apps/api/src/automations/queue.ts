import { CurrencySchema } from '@finora/shared';
import { z } from 'zod';

export const AutomationQueueMessageSchema = z
  .object({
    kind: z.literal('evaluate'),
    automationId: z.uuid(),
    eventId: z.string().min(1),
    /** A manual "Run now": skips the trigger, conditions, and cooldown. */
    forced: z.boolean().optional(),
    context: z
      .object({
        amount: z.number().nonnegative().optional(),
        currency: CurrencySchema.optional(),
        supplierId: z.string().optional(),
        senderDomain: z.string().optional(),
        walletBalance: z.number().nonnegative().optional(),
        invoiceDueInDays: z.number().int().optional(),
        now: z.iso.datetime().optional(),
        /** What happened, in a few words, e.g. "Invoice INV-104 from Acme, USD 500". */
        event: z.string().max(240).optional(),
      })
      .default({}),
  })
  .strict();

export type AutomationQueueMessage = z.infer<typeof AutomationQueueMessageSchema>;
