import { z } from 'zod';

export const GmailIntegrationStatusSchema = z.object({
  connected: z.boolean(),
  email: z.email().nullable(),
  status: z.enum(['disconnected', 'connected', 'syncing', 'error', 'reauthorization_required']),
  lastSyncedAt: z.iso.datetime().nullable(),
  candidateCount: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
});
export type GmailIntegrationStatus = z.infer<typeof GmailIntegrationStatusSchema>;

export const GmailConnectRequestSchema = z.object({
  returnUrl: z.string().min(1).max(2_048),
});

export const GmailConnectResponseSchema = z.object({
  authorizationUrl: z.url(),
});

export const GmailSyncResponseSchema = z.object({ queued: z.literal(true) });
