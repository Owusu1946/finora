import { and, eq, isNull } from 'drizzle-orm';

import { createDb } from '../db/client';
import { payrollImportRows, payrollImports } from '../db/schema';
import { createPreparation } from '../mock/store';

export class PayrollPreparationError extends Error {
  constructor(
    public readonly code: 'payroll_import_not_found' | 'payroll_import_blocked',
    public readonly status: 404 | 409,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'PayrollPreparationError';
  }
}

export async function preparePayrollImport(input: {
  databaseUrl: string;
  userId: string;
  importId: string;
  period?: string;
}) {
  const db = createDb(input.databaseUrl);
  const [payrollImport] = await db
    .select()
    .from(payrollImports)
    .where(
      and(
        eq(payrollImports.id, input.importId),
        eq(payrollImports.clerkUserId, input.userId),
        isNull(payrollImports.deletedAt),
      ),
    )
    .limit(1);

  if (!payrollImport) throw new PayrollPreparationError('payroll_import_not_found', 404);
  if (payrollImport.status !== 'ready') {
    throw new PayrollPreparationError('payroll_import_blocked', 409, {
      blockingIssues: payrollImport.blockingIssues,
    });
  }

  const importedRows = await db
    .select({ payload: payrollImportRows.payload })
    .from(payrollImportRows)
    .where(eq(payrollImportRows.importId, payrollImport.id));

  const employees = importedRows.map(({ payload }) => ({
    id: String(payload.employeeId ?? payload.rowId ?? crypto.randomUUID()),
    name: String(payload.employeeName ?? 'Employee'),
    role: String(payload.role ?? 'Imported payroll'),
    salary: Number(payload.amount ?? 0),
    currency: String(payload.currency ?? payrollImport.currency ?? 'USD'),
    destination: {
      kind:
        String(payload.destinationType ?? '').toLowerCase().includes('mobile') ||
        String(payload.rail ?? '').toLowerCase().includes('momo')
          ? 'mobile_money'
          : 'bank_account',
      label: String(payload.rail ?? payload.destinationType ?? 'Payout destination'),
      value: String(payload.destination ?? ''),
    },
    reference: payload.reference ?? null,
    citations: payload.citations ?? [],
  }));

  return createPreparation('payroll', {
    importId: payrollImport.id,
    period: payrollImport.period ?? input.period,
    employees,
    total: Number(payrollImport.total ?? 0),
    currency: payrollImport.currency ?? 'USD',
  });
}
