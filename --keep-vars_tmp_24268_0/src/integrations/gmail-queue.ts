import { z } from 'zod';

export const GmailSyncQueueMessageSchema = z.object({
  kind: z.literal('gmail.initial-sync'),
  integrationId: z.uuid(),
  pageToken: z.string().min(1).max(2_000).optional(),
  candidateCount: z.number().int().nonnegative().optional(),
});

export type GmailSyncQueueMessage = z.infer<typeof GmailSyncQueueMessageSchema>;
