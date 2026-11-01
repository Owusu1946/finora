import type { ExecuteActionRequest, PlanActionInput, PlanResult } from '@finora/shared';

import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client';

import { ActionError, executeAction, getAction } from '../actions/actions';
import { payrollRuns, preparedActions } from '../db/schema';
import { LedgerError, listLedgerWallets } from '../ledger/ledger';
import { executePayrollRun, PayrollPreparationError } from '../payroll/prepare-import';
import { walletForCurrency } from './daily';

const ERRORS: Record<string, string> = {
  insufficient_funds: 'Not enough in the wallet.',
  action_blocked: 'Blocked by your policies.',
  already_paid: 'Already paid.',
  action_not_pending: 'It was cancelled.',
  payroll_run_not_pending: 'It was cancelled.',
  wallet_not_found: 'No wallet to pay it from.',
  conversion_wallet_missing: 'No wallet in that currency.',
};

function errorText(error: unknown) {
  if (
    error instanceof ActionError ||
    error instanceof LedgerError ||
    error instanceof PayrollPreparationError
  ) {
    return ERRORS[error.code] ?? 'It didn’t go through.';
  }
  // Unexpected: record it against this item so the rest of the plan still runs.
  console.error('[plans:item]', { errorName: error instanceof Error ? error.name : typeof error });
  return 'It didn’t go through.';
}

async function payChild(
  databaseUrl: string,
  db: Database,
  userId: string,
  child: NonNullable<PlanActionInput['children']>[number],
  title: string,
): Promise<PlanResult> {
  const base = { type: child.type, id: child.id, title };
  try {
    if (child.type === 'action') {
      const action = await executeAction(db, userId, child.id);
      return { ...base, status: 'paid', transactionId: action.transactionId, error: null };
    }
    const [run] = await db
      .select({ currency: payrollRuns.currency })
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, child.id), eq(payrollRuns.clerkUserId, userId)))
      .limit(1);
    const wallet = run
      ? walletForCurrency((await listLedgerWallets(db, userId)).wallets, run.currency)
      : null;
    if (!wallet)
      return { ...base, status: 'failed', transactionId: null, error: ERRORS.wallet_not_found! };
    await executePayrollRun(databaseUrl, userId, child.id, { fundingWalletId: wallet.id });
    return { ...base, status: 'paid', transactionId: null, error: null };
  } catch (error) {
    // Paid on its own (from its card or the inbox) before the plan ran.
    if (
      child.type === 'action' &&
      error instanceof ActionError &&
      error.code === 'action_not_pending'
    ) {
      const action = await getAction(db, userId, child.id);
      if (action.status === 'executed') {
        return { ...base, status: 'paid', transactionId: action.transactionId, error: null };
      }
    }
    if (error instanceof PayrollPreparationError && error.details?.status === 'completed') {
      return { ...base, status: 'paid', transactionId: null, error: null };
    }
    return { ...base, status: 'failed', transactionId: null, error: errorText(error) };
  }
}

/**
 * Runs an approved plan: pays each item in order (conversions first), each
 * through its own checks and ledger transaction, and records how each went.
 * An item that fails moves no money; the rest still run. The plan runs once.
 */
export async function executePlan(databaseUrl: string, db: Database, userId: string, id: string) {
  const [claimed] = await db
    .update(preparedActions)
    .set({ status: 'executing', updatedAt: new Date() })
    .where(
      and(
        eq(preparedActions.id, id),
        eq(preparedActions.clerkUserId, userId),
        eq(preparedActions.status, 'pending_approval'),
      ),
    )
    .returning();
  if (!claimed) {
    const action = await getAction(db, userId, id);
    throw new ActionError('action_not_pending', 409, { status: action.status });
  }
  const payload = claimed.payload as PlanActionInput;
  const results: PlanResult[] = [];
  for (const [index, child] of (payload.children ?? []).entries()) {
    results.push(
      await payChild(databaseUrl, db, userId, child, payload.items[index]?.title ?? 'Payment'),
    );
  }
  const failed = results.filter((result) => result.status === 'failed').length;
  const now = new Date();
  await db
    .update(preparedActions)
    .set({
      status: failed ? 'failed' : 'executed',
      results,
      failureReason: failed ? `${failed} of ${results.length} didn't go through.` : null,
      executedAt: now,
      updatedAt: now,
    })
    .where(eq(preparedActions.id, id));
  return getAction(db, userId, id);
}

/** Executes any approved action: plans with items run item by item, the rest settle at once. */
export async function executeAnyAction(
  databaseUrl: string,
  db: Database,
  userId: string,
  id: string,
  request: ExecuteActionRequest = {},
) {
  const [row] = await db
    .select({ kind: preparedActions.kind, payload: preparedActions.payload })
    .from(preparedActions)
    .where(and(eq(preparedActions.id, id), eq(preparedActions.clerkUserId, userId)))
    .limit(1);
  const plan = row?.kind === 'plan' ? (row.payload as PlanActionInput) : null;
  if (plan?.children?.length) return executePlan(databaseUrl, db, userId, id);
  return executeAction(db, userId, id, request);
}
