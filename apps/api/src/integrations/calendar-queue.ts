import { z } from 'zod';

export const CalendarSyncQueueMessageSchema = z.object({
  kind: z.literal('calendar.sync'),
  integrationId: z.uuid(),
  pageToken: z.string().min(1).max(2_000).optional(),
});
export type CalendarSyncQueueMessage = z.infer<typeof CalendarSyncQueueMessageSchema>;
