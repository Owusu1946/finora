import { CurrencySchema } from '@finora/shared';
import { z } from 'zod';

export const AutomationQueueMessageSchema = z
  .object({
    kind: z.literal('evaluate'),
    automationId: z.uuid(),
    eventId: z.string().min(1),
    context: z
      .object({
        amount: z.number().nonnegative().optional(),
        currency: CurrencySchema.optional(),
        supplierId: z.string().optional(),
        senderDomain: z.string().optional(),
        walletBalance: z.number().nonnegative().optional(),
        invoiceDueInDays: z.number().int().optional(),
        now: z.iso.datetime().optional(),
      })
      .default({}),
  })
  .strict();

export type AutomationQueueMessage = z.infer<typeof AutomationQueueMessageSchema>;
