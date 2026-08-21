import { and, eq, isNull } from 'drizzle-orm';

import { createDb } from '../db/client';
import { payrollImportRows, payrollImports } from '../db/schema';
import { createPreparation } from '../mock/store';

export class PayrollPreparationError extends Error {
  constructor(
    public readonly code: 'payroll_import_not_found' | 'payroll_import_blocked' | 'payroll_row_not_found' | 'payroll_currency_mismatch',
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
  rowIds?: string[];
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

  const selectedIds = input.rowIds ? new Set(input.rowIds) : null;
  const selectedRows = selectedIds
    ? importedRows.filter(({ payload }) => selectedIds.has(String(payload.rowId ?? '')))
    : importedRows;
  if (selectedIds && selectedRows.length !== selectedIds.size) {
    throw new PayrollPreparationError('payroll_row_not_found', 404);
  }
  const currencies = new Set(selectedRows.map(({ payload }) => String(payload.currency ?? payrollImport.currency ?? 'USD').toUpperCase()));
  if (currencies.size > 1) throw new PayrollPreparationError('payroll_currency_mismatch', 409);

  const employees = selectedRows.map(({ payload }) => ({
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
    total: employees.reduce((total, employee) => total + employee.salary, 0),
    currency: employees[0]?.currency ?? payrollImport.currency ?? 'USD',
  });
}

export async function prepareImportedEmployeePayment(input: {
  databaseUrl: string;
  userId: string;
  importId: string;
  rowId: string;
  amount?: number;
  currency?: string;
  reference?: string;
}) {
  const db = createDb(input.databaseUrl);
  const [payrollImport] = await db.select().from(payrollImports).where(and(eq(payrollImports.id, input.importId), eq(payrollImports.clerkUserId, input.userId), isNull(payrollImports.deletedAt))).limit(1);
  if (!payrollImport) throw new PayrollPreparationError('payroll_import_not_found', 404);
  if (payrollImport.status !== 'ready') throw new PayrollPreparationError('payroll_import_blocked', 409, { blockingIssues: payrollImport.blockingIssues });
  const [stored] = await db.select({ payload: payrollImportRows.payload }).from(payrollImportRows).where(and(eq(payrollImportRows.importId, payrollImport.id), eq(payrollImportRows.rowId, input.rowId))).limit(1);
  if (!stored) throw new PayrollPreparationError('payroll_row_not_found', 404);
  const payload = stored.payload;
  const employee = {
    id: String(payload.employeeId ?? payload.rowId),
    name: String(payload.employeeName ?? 'Employee'),
    role: String(payload.role ?? 'Employee'),
    salary: Number(payload.amount ?? 0),
    currency: String(payload.currency ?? payrollImport.currency ?? 'USD').toUpperCase(),
    destination: {
      kind: String(payload.destinationType ?? '').toLowerCase().includes('mobile') ? 'mobile_money' : 'bank_account',
      label: String(payload.rail ?? payload.destinationType ?? 'Payout destination'),
      value: String(payload.destination ?? ''),
    },
  };
  const storedCurrency = employee.currency;
  const requestedCurrency = input.currency?.toUpperCase() ?? storedCurrency;
  if (requestedCurrency !== storedCurrency) throw new PayrollPreparationError('payroll_currency_mismatch', 409);
  const amount = input.amount ?? employee.salary;
  const memo = input.reference ?? String(payload.reference ?? `Salary · ${employee.name}`);
  return {
    ...createPreparation('payment', {
      employeeId: employee.id,
      importId: payrollImport.id,
      rowId: input.rowId,
      recipientName: employee.name,
      amount: { amount, currency: requestedCurrency },
      destinationKind: employee.destination.kind,
      destinationLabel: employee.destination.label,
      destinationValue: employee.destination.value,
      purposeCode: 'SALARY',
      reference: memo,
    }),
    employee: { ...employee, salary: amount, currency: requestedCurrency },
    amount,
    currency: requestedCurrency,
    memo,
  };
}
