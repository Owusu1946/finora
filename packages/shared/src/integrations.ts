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

export const CalendarIntegrationStatusSchema = z.object({
  connected: z.boolean(),
  email: z.email().nullable(),
  status: z.enum(['disconnected', 'connected', 'syncing', 'error', 'reauthorization_required']),
  lastSyncedAt: z.iso.datetime().nullable(),
  eventCount: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
});
export type CalendarIntegrationStatus = z.infer<typeof CalendarIntegrationStatusSchema>;

export const CalendarConnectRequestSchema = z.object({
  returnUrl: z.string().min(1).max(2_048),
});

export const CalendarConnectResponseSchema = z.object({
  authorizationUrl: z.url(),
});

export const CalendarSyncResponseSchema = z.object({ queued: z.literal(true) });

export const CalendarMoneyEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['rent', 'payroll', 'bill', 'subscription', 'tax', 'other']),
  dueAt: z.iso.datetime(),
  amount: z.number().positive().nullable(),
  currency: z.string().length(3).nullable(),
  counterparty: z.string().nullable(),
  notes: z.string().nullable(),
  sourceUrl: z.url().nullable(),
});
export type CalendarMoneyEvent = z.infer<typeof CalendarMoneyEventSchema>;

export const DriveIntegrationStatusSchema = z.object({
  connected: z.boolean(),
  email: z.email().nullable(),
  status: z.enum(['disconnected', 'connected', 'syncing', 'error', 'reauthorization_required']),
  lastSyncedAt: z.iso.datetime().nullable(),
  fileCount: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
});
export type DriveIntegrationStatus = z.infer<typeof DriveIntegrationStatusSchema>;

export const DriveConnectRequestSchema = z.object({ returnUrl: z.string().min(1).max(2_048) });
export const DriveConnectResponseSchema = z.object({ authorizationUrl: z.url() });
export const DriveFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.iso.datetime().nullable(),
  webUrl: z.url().nullable(),
  snippet: z.string().nullable(),
});
export const DriveSearchResponseSchema = z.object({
  files: z.array(DriveFileSchema),
  nextPageToken: z.string().nullable(),
});
export const DriveFileContentSchema = z.object({
  file: DriveFileSchema,
  text: z.string(),
  citations: z.array(
    z.object({
      quote: z.string(),
      location: z.string(),
    }),
  ),
});
export type DriveFileContent = z.infer<typeof DriveFileContentSchema>;
