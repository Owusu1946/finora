import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().max(max);

export const PayrollAttachmentStatusSchema = z.enum(['uploaded', 'inspecting', 'ready', 'failed', 'expired']);
export type PayrollAttachmentStatus = z.infer<typeof PayrollAttachmentStatusSchema>;

export const PayrollImportStatusSchema = z.enum(['inspecting', 'ready', 'blocked', 'failed']);

export const PayrollCitationSchema = z.object({
  sourceName: boundedText(255),
  location: boundedText(120),
  quote: boundedText(500).optional(),
}).strict();

export const PayrollValidationIssueSchema = z.object({
  code: boundedText(80),
  message: boundedText(300),
  rowId: boundedText(80).optional(),
  blocking: z.boolean(),
}).strict();

export const PayrollImportRowSchema = z.object({
  rowId: boundedText(80),
  employeeName: boundedText(200).nullable(),
  employeeId: boundedText(120).nullable(),
  role: boundedText(160).nullable().default(null),
  amount: z.number().finite().nonnegative().nullable(),
  currency: boundedText(12).nullable(),
  destinationType: boundedText(40).nullable().default(null),
  destination: boundedText(160).nullable(),
  rail: boundedText(40).nullable(),
  period: boundedText(80).nullable(),
  payDate: z.string().date().nullable(),
  reference: boundedText(140).nullable().default(null),
  confidence: z.number().min(0).max(1),
  citations: z.array(PayrollCitationSchema).max(8),
  issues: z.array(PayrollValidationIssueSchema).max(12),
}).strict();

export const PayrollInspectionResponseSchema = z.object({
  ok: z.boolean(),
  attachmentId: z.string().uuid(),
  importId: z.string().uuid().optional(),
  sourceName: boundedText(255).optional(),
  status: PayrollImportStatusSchema.optional(),
  rows: z.array(PayrollImportRowSchema).max(500).optional(),
  blockingIssues: z.array(PayrollValidationIssueSchema).max(200).optional(),
  warnings: z.array(PayrollValidationIssueSchema).max(200).optional(),
  totals: z.object({ total: z.number().finite().nonnegative(), currency: boundedText(12) }).strict().optional(),
  errorCode: boundedText(100).optional(),
}).strict();

export type PayrollCitation = z.infer<typeof PayrollCitationSchema>;
export type PayrollValidationIssue = z.infer<typeof PayrollValidationIssueSchema>;
export type PayrollImportRow = z.infer<typeof PayrollImportRowSchema>;
export type PayrollInspectionResponse = z.infer<typeof PayrollInspectionResponseSchema>;

export const PayrollAttachmentReferenceSchema = z.object({
  attachmentId: z.string().uuid(),
  name: boundedText(255),
}).strict();
