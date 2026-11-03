import type { ExecutePayrollRunRequest, PayrollRun } from '@finora/shared';

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { createDb } from '../db/client';
import { payrollImportRows, payrollImports, payrollRunItems, payrollRuns } from '../db/schema';
import { settle, walletCost } from '../ledger/ledger';

export class PayrollPreparationError extends Error {
  constructor(
    public readonly code:
      | 'payroll_import_not_found'
      | 'payroll_import_blocked'
      | 'payroll_row_not_found'
      | 'payroll_currency_mismatch'
      | 'payroll_empty'
      | 'payroll_run_not_found'
      | 'payroll_run_not_pending',
    public readonly status: 404 | 409,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'PayrollPreparationError';
  }
}

type RunRow = typeof payrollRuns.$inferSelect;
type ItemRow = typeof payrollRunItems.$inferSelect;
type NewItem = Omit<typeof payrollRunItems.$inferInsert, 'runId' | 'position'>;

const toMinor = (amount: number) => Math.round(amount * 100);
const fromMinor = (amount: number) => amount / 100;

/** Shows only the last four characters of an account or phone number. */
export function maskDestination(value: string) {
  const compact = value.replace(/\s+/g, '');
  return compact.length <= 4 ? compact : `•••• ${compact.slice(-4)}`;
}

function destinationKind(payload: Record<string, unknown>) {
  const hint = `${payload.destinationType ?? ''} ${payload.rail ?? ''}`.toLowerCase();
  return hint.includes('mobile') || hint.includes('momo') ? 'mobile_money' : 'bank_account';
}

function itemFromRow(
  payload: Record<string, unknown>,
  overrides?: { amount?: number; reference?: string },
): NewItem {
  return {
    rowId: String(payload.rowId ?? ''),
    employeeName: String(payload.employeeName ?? 'Employee'),
    employeeId: payload.employeeId == null ? null : String(payload.employeeId),
    role: payload.role == null ? null : String(payload.role),
    amountMinor: toMinor(overrides?.amount ?? Number(payload.amount ?? 0)),
    destinationKind: destinationKind(payload),
    destinationLabel: String(payload.rail ?? payload.destinationType ?? 'Payout destination'),
    destinationValue: String(payload.destination ?? ''),
    reference:
      overrides?.reference ?? (payload.reference == null ? null : String(payload.reference)),
  };
}

export function toPayrollRun(run: RunRow, items: ItemRow[]): PayrollRun {
  return {
    id: run.id,
    kind: run.kind,
    importId: run.importId,
    period: run.period,
    currency: run.currency,
    total: fromMinor(run.totalMinor),
    status: run.status,
    mode: run.mode,
    funding:
      run.fundingWalletId && run.fundingCurrency && run.fundingAmountMinor != null
        ? {
            walletId: run.fundingWalletId,
            currency: run.fundingCurrency,
            amount: fromMinor(run.fundingAmountMinor),
          }
        : null,
    items: [...items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        employeeName: item.employeeName,
        role: item.role,
        amount: fromMinor(item.amountMinor),
        destination: {
          kind: item.destinationKind === 'mobile_money' ? 'mobile_money' : 'bank_account',
          label: item.destinationLabel,
          value: maskDestination(item.destinationValue),
        },
        reference: item.reference,
        status: item.status,
        failureReason: item.failureReason,
      })),
    createdAt: run.createdAt.toISOString(),
    executedAt: run.executedAt?.toISOString() ?? null,
  };
}

async function readyImport(databaseUrl: string, userId: string, importId: string) {
  const db = createDb(databaseUrl);
  const [payrollImport] = await db
    .select()
    .from(payrollImports)
    .where(
      and(
        eq(payrollImports.id, importId),
        eq(payrollImports.clerkUserId, userId),
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
  return { db, payrollImport };
}

async function insertRun(
  db: ReturnType<typeof createDb>,
  run: Omit<typeof payrollRuns.$inferInsert, 'totalMinor'>,
  items: NewItem[],
) {
  if (items.length === 0) throw new PayrollPreparationError('payroll_empty', 409);
  const [created] = await db
    .insert(payrollRuns)
    .values({ ...run, totalMinor: items.reduce((sum, item) => sum + item.amountMinor, 0) })
    .returning();
  const createdItems = await db
    .insert(payrollRunItems)
    .values(items.map((item, position) => ({ ...item, runId: created!.id, position })))
    .returning();
  return toPayrollRun(created!, createdItems);
}

/** Prepares a full or partial imported payroll as a run awaiting approval. */
export async function preparePayrollImport(input: {
  databaseUrl: string;
  userId: string;
  importId: string;
  period?: string;
  rowIds?: string[];
}) {
  const { db, payrollImport } = await readyImport(input.databaseUrl, input.userId, input.importId);
  const importedRows = await db
    .select({ payload: payrollImportRows.payload })
    .from(payrollImportRows)
    .where(eq(payrollImportRows.importId, payrollImport.id))
    .orderBy(asc(payrollImportRows.createdAt));

  const selectedIds = input.rowIds ? new Set(input.rowIds) : null;
  const selectedRows = selectedIds
    ? importedRows.filter(({ payload }) => selectedIds.has(String(payload.rowId ?? '')))
    : importedRows;
  if (selectedIds && selectedRows.length !== selectedIds.size) {
    throw new PayrollPreparationError('payroll_row_not_found', 404);
  }
  const currencies = new Set(
    selectedRows.map(({ payload }) =>
      String(payload.currency ?? payrollImport.currency ?? 'USD').toUpperCase(),
    ),
  );
  // One currency per run; the user can run each currency separately.
  if (currencies.size > 1) {
    throw new PayrollPreparationError('payroll_currency_mismatch', 409, {
      currencies: [...currencies],
    });
  }

  return insertRun(
    db,
    {
      clerkUserId: input.userId,
      importId: payrollImport.id,
      kind: 'payroll',
      period: input.period ?? payrollImport.period,
      currency: [...currencies][0] ?? 'USD',
    },
    selectedRows.map(({ payload }) => itemFromRow(payload)),
  );
}

/** Prepares one employee's payment (salary, bonus, or part) as a single-item run. */
export async function prepareImportedEmployeePayment(input: {
  databaseUrl: string;
  userId: string;
  importId: string;
  rowId: string;
  amount?: number;
  currency?: string;
  reference?: string;
}) {
  const { db, payrollImport } = await readyImport(input.databaseUrl, input.userId, input.importId);
  const [stored] = await db
    .select({ payload: payrollImportRows.payload })
    .from(payrollImportRows)
    .where(
      and(
        eq(payrollImportRows.importId, payrollImport.id),
        eq(payrollImportRows.rowId, input.rowId),
      ),
    )
    .limit(1);
  if (!stored) throw new PayrollPreparationError('payroll_row_not_found', 404);
  const currency = String(stored.payload.currency ?? payrollImport.currency ?? 'USD').toUpperCase();
  if (input.currency && input.currency.toUpperCase() !== currency) {
    throw new PayrollPreparationError('payroll_currency_mismatch', 409);
  }
  const name = String(stored.payload.employeeName ?? 'Employee');
  return insertRun(
    db,
    {
      clerkUserId: input.userId,
      importId: payrollImport.id,
      kind: 'single',
      period: payrollImport.period,
      currency,
    },
    [
      itemFromRow(stored.payload, {
        amount: input.amount,
        reference: input.reference ?? `Salary · ${name}`,
      }),
    ],
  );
}

async function ownedRun(db: ReturnType<typeof createDb>, userId: string, runId: string) {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.clerkUserId, userId)))
    .limit(1);
  if (!run) throw new PayrollPreparationError('payroll_run_not_found', 404);
  return run;
}

async function itemsFor(db: ReturnType<typeof createDb>, runId: string) {
  return db.select().from(payrollRunItems).where(eq(payrollRunItems.runId, runId));
}

export async function getPayrollRun(databaseUrl: string, userId: string, runId: string) {
  const db = createDb(databaseUrl);
  const run = await ownedRun(db, userId, runId);
  return toPayrollRun(run, await itemsFor(db, run.id));
}

export async function listPayrollRuns(databaseUrl: string, userId: string, limit = 20) {
  const db = createDb(databaseUrl);
  const runs = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.clerkUserId, userId), eq(payrollRuns.status, 'completed')))
    .orderBy(desc(payrollRuns.executedAt))
    .limit(limit);
  return Promise.all(runs.map(async (run) => toPayrollRun(run, await itemsFor(db, run.id))));
}

/**
 * Executes a run the user approved with their passcode: takes the total from
 * the chosen wallet (converted at demo rates, no fee) and marks every payout
 * sent, in one ledger transaction. A run settles once, so a retried request
 * can't pay twice. Payouts are simulated (`mode: demo`) until WeWire is live.
 */
export async function executePayrollRun(
  databaseUrl: string,
  userId: string,
  runId: string,
  funding: ExecutePayrollRunRequest,
) {
  const db = createDb(databaseUrl);
  const run = await ownedRun(db, userId, runId);
  if (run.status !== 'pending_approval') {
    throw new PayrollPreparationError('payroll_run_not_pending', 409, { status: run.status });
  }
  const items = await itemsFor(db, run.id);
  const total = fromMinor(run.totalMinor);
  const cost = await walletCost(db, userId, funding.fundingWalletId, total, run.currency);
  const charged = Math.max(0.01, cost.amount);
  const now = new Date();

  await settle(
    db,
    {
      userId,
      kind: 'payroll_run',
      sourceId: run.id,
      source: 'chat',
      direction: 'sent',
      currency: cost.wallet.currency,
      amount: charged,
      ...(cost.wallet.currency === run.currency
        ? {}
        : { toCurrency: run.currency, toAmount: total }),
      counterparty:
        run.kind === 'single'
          ? (items[0]?.employeeName ?? 'Employee')
          : `Payroll · ${items.length} ${items.length === 1 ? 'person' : 'people'}`,
      method: 'Payroll',
      reference: run.period ? `Payroll ${run.period}` : 'Payroll',
      legs: [{ walletId: cost.wallet.id, amount: -charged }],
    },
    () => [
      db
        .update(payrollRuns)
        .set({
          status: 'completed',
          fundingWalletId: cost.wallet.id,
          fundingCurrency: cost.wallet.currency,
          fundingAmountMinor: toMinor(charged),
          approvedAt: now,
          executedAt: now,
          updatedAt: now,
        })
        .where(and(eq(payrollRuns.id, run.id), eq(payrollRuns.status, 'pending_approval'))),
      db
        .update(payrollRunItems)
        .set({ status: 'sent', sentAt: now })
        .where(eq(payrollRunItems.runId, run.id)),
    ],
  );

  const paid = await ownedRun(db, userId, run.id);
  if (paid.status !== 'completed') {
    // Cancelled between the check and the payment: put the money back.
    await settle(db, {
      userId,
      kind: 'payroll_refund',
      sourceId: run.id,
      source: 'chat',
      direction: 'received',
      currency: cost.wallet.currency,
      amount: charged,
      counterparty: 'Payroll refund',
      method: 'Refund',
      legs: [{ walletId: cost.wallet.id, amount: charged }],
    });
    throw new PayrollPreparationError('payroll_run_not_pending', 409, { status: paid.status });
  }
  return toPayrollRun(paid, await itemsFor(db, run.id));
}

export async function cancelPayrollRun(databaseUrl: string, userId: string, runId: string) {
  const db = createDb(databaseUrl);
  const [cancelled] = await db
    .update(payrollRuns)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(payrollRuns.id, runId),
        eq(payrollRuns.clerkUserId, userId),
        eq(payrollRuns.status, 'pending_approval'),
      ),
    )
    .returning();
  if (!cancelled) {
    const run = await ownedRun(db, userId, runId);
    throw new PayrollPreparationError('payroll_run_not_pending', 409, { status: run.status });
  }
  return toPayrollRun(cancelled, await itemsFor(db, runId));
}
