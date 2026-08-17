import { z } from 'zod';

export const GmailSyncQueueMessageSchema = z.object({
  kind: z.literal('gmail.initial-sync'),
  integrationId: z.uuid(),
});

export type GmailSyncQueueMessage = z.infer<typeof GmailSyncQueueMessageSchema>;
