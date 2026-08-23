import { z } from 'zod';

export const InvoiceDateRangeSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  timezone: z.string().min(1).max(64),
});
export type InvoiceDateRange = z.infer<typeof InvoiceDateRangeSchema>;

export const InvoicePreferencesSchema = InvoiceDateRangeSchema.extend({
  updatedAt: z.iso.datetime(),
});
export type InvoicePreferences = z.infer<typeof InvoicePreferencesSchema>;

export const RemoteInvoiceSchema = z.object({
  id: z.string().uuid(),
  vendor: z.string().min(1),
  invoiceNumber: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  dueDate: z.iso.datetime().nullable(),
  status: z.enum(['due', 'scheduled', 'paid', 'dismissed']),
  source: z.literal('gmail'),
  description: z.string().nullable(),
  receivedAt: z.iso.datetime(),
  hasAttachment: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type RemoteInvoice = z.infer<typeof RemoteInvoiceSchema>;

export const InvoiceListResponseSchema = z.object({
  invoices: z.array(RemoteInvoiceSchema),
  nextCursor: z.string().nullable(),
  syncStatus: z.enum(['fresh', 'syncing', 'stale', 'error', 'disconnected']),
  lastSyncedAt: z.iso.datetime().nullable(),
  preferences: InvoicePreferencesSchema,
});
export type InvoiceListResponse = z.infer<typeof InvoiceListResponseSchema>;

export const InvoicePreferencesUpdateSchema = InvoiceDateRangeSchema;
