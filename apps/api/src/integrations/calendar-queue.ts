import { z } from 'zod';

export const CalendarSyncQueueMessageSchema = z.object({
  kind: z.literal('calendar.sync'),
  integrationId: z.uuid(),
});
export type CalendarSyncQueueMessage = z.infer<typeof CalendarSyncQueueMessageSchema>;
