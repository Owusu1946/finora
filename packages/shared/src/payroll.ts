import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().max(max);

export const PayrollAttachmentStatusSchema = z.enum([
  'uploaded',
  'inspecting',
  'ready',
  'failed',
  'expired',
]);
export type PayrollAttachmentStatus = z.infer<typeof PayrollAttachmentStatusSchema>;

export const PayrollImportStatusSchema = z.enum(['inspecting', 'ready', 'blocked', 'failed']);

export const PayrollCitationSchema = z
  .object({
    sourceName: boundedText(255),
    location: boundedText(120),
    quote: boundedText(500).optional(),
  })
  .strict();

export const PayrollValidationIssueSchema = z
  .object({
    code: boundedText(80),
    message: boundedText(300),
    rowId: boundedText(80).optional(),
    blocking: z.boolean(),
  })
  .strict();

export const PayrollImportRowSchema = z
  .object({
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
  })
  .strict();

export const PayrollInspectionResponseSchema = z
  .object({
    ok: z.boolean(),
    attachmentId: z.string().uuid(),
    importId: z.string().uuid().optional(),
    sourceName: boundedText(255).optional(),
    status: PayrollImportStatusSchema.optional(),
    rows: z.array(PayrollImportRowSchema).max(500).optional(),
    blockingIssues: z.array(PayrollValidationIssueSchema).max(200).optional(),
    warnings: z.array(PayrollValidationIssueSchema).max(200).optional(),
    totals: z
      .object({ total: z.number().finite().nonnegative(), currency: boundedText(12) })
      .strict()
      .optional(),
    errorCode: boundedText(100).optional(),
  })
  .strict();

export type PayrollCitation = z.infer<typeof PayrollCitationSchema>;
export type PayrollValidationIssue = z.infer<typeof PayrollValidationIssueSchema>;
export type PayrollImportRow = z.infer<typeof PayrollImportRowSchema>;

export const PayrollEditPatchSchema = z
  .object({
    employeeName: boundedText(200).nullable().optional(),
    employeeId: boundedText(120).nullable().optional(),
    role: boundedText(160).nullable().optional(),
    amount: z.number().finite().nonnegative().nullable().optional(),
    currency: boundedText(12).nullable().optional(),
    destinationType: boundedText(40).nullable().optional(),
    destination: boundedText(160).nullable().optional(),
    rail: boundedText(40).nullable().optional(),
    period: boundedText(80).nullable().optional(),
    payDate: z.string().date().nullable().optional(),
    reference: boundedText(140).nullable().optional(),
  })
  .strict();

export const PayrollEditChangeSchema = z
  .object({
    rowId: boundedText(80),
    operation: z.enum(['update', 'delete']),
    patch: PayrollEditPatchSchema.optional(),
  })
  .strict()
  .superRefine((change, ctx) => {
    if (
      change.operation === 'update' &&
      (!change.patch || Object.keys(change.patch).length === 0)
    ) {
      ctx.addIssue({ code: 'custom', message: 'An update requires at least one field.' });
    }
    if (change.operation === 'delete' && change.patch) {
      ctx.addIssue({ code: 'custom', message: 'A delete cannot include a patch.' });
    }
  });

export const ProposePayrollChangesInputSchema = z
  .object({
    importId: z.string().uuid(),
    changes: z.array(PayrollEditChangeSchema).min(1).max(100),
  })
  .strict();

export const ListPayrollImportsInputSchema = z
  .object({
    query: boundedText(200).optional(),
    importId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export const ApplyPayrollChangesInputSchema = z.object({ proposalId: z.string().uuid() }).strict();
export const BulkDeletePayrollRowsInputSchema = z
  .object({
    rowIds: z.array(boundedText(80)).min(1).max(500),
    version: z.number().int().positive(),
  })
  .strict()
  .superRefine(({ rowIds }, ctx) => {
    if (new Set(rowIds).size !== rowIds.length) {
      ctx.addIssue({ code: 'custom', message: 'Row IDs must be unique.' });
    }
  });
export const ArchivePayrollImportInputSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();
export const BulkArchivePayrollImportsInputSchema = z
  .object({
    imports: z
      .array(
        z
          .object({
            importId: z.string().uuid(),
            version: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine(({ imports }, ctx) => {
    if (new Set(imports.map(({ importId }) => importId)).size !== imports.length) {
      ctx.addIssue({ code: 'custom', message: 'Payroll import IDs must be unique.' });
    }
  });
export type PayrollInspectionResponse = z.infer<typeof PayrollInspectionResponseSchema>;

export const PayrollAttachmentReferenceSchema = z
  .object({
    attachmentId: z.string().uuid(),
    name: boundedText(255),
  })
  .strict();

export const PayrollRunStatusSchema = z.enum([
  'pending_approval',
  'completed',
  'failed',
  'cancelled',
]);
export const PayrollRunItemStatusSchema = z.enum(['pending', 'sent', 'failed']);

/** One employee's payout in a run. The destination value is masked. */
export const PayrollRunItemSchema = z.object({
  id: z.string(),
  employeeName: z.string(),
  role: z.string().nullable(),
  amount: z.number().nonnegative(),
  destination: z.object({
    kind: z.enum(['mobile_money', 'bank_account']),
    label: z.string(),
    value: z.string(),
  }),
  reference: z.string().nullable(),
  status: PayrollRunItemStatusSchema,
  failureReason: z.string().nullable(),
});
export type PayrollRunItem = z.infer<typeof PayrollRunItemSchema>;

/**
 * A prepared payroll (or single employee payment). It pays nobody until the
 * user approves it with the passcode in the app. Amounts are in major units.
 */
export const PayrollRunSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['payroll', 'single']),
  importId: z.string().nullable(),
  period: z.string().nullable(),
  currency: z.string(),
  total: z.number().nonnegative(),
  status: PayrollRunStatusSchema,
  /** `demo` until WeWire payouts are live: nobody is really paid. */
  mode: z.enum(['demo', 'live']),
  funding: z
    .object({ walletId: z.string(), currency: z.string(), amount: z.number().nonnegative() })
    .nullable(),
  items: z.array(PayrollRunItemSchema),
  createdAt: z.iso.datetime(),
  executedAt: z.iso.datetime().nullable(),
});
export type PayrollRun = z.infer<typeof PayrollRunSchema>;

export const PayrollRunResponseSchema = z.object({ run: PayrollRunSchema });
export const PayrollRunListResponseSchema = z.object({ runs: z.array(PayrollRunSchema) });

/** Approve and pay a run from a wallet. One currency per run; funding may convert. */
export const ExecutePayrollRunRequestSchema = z
  .object({
    fundingWalletId: z.string().min(1).max(80),
    fundingCurrency: z.string().min(3).max(12),
    fundingAmount: z.number().positive(),
  })
  .strict();
export type ExecutePayrollRunRequest = z.infer<typeof ExecutePayrollRunRequestSchema>;
