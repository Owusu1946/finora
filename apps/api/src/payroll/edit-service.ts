import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  PayrollEditChangeSchema,
  PayrollEditPatchSchema,
  PayrollImportRowSchema,
  ProposePayrollChangesInputSchema,
  type PayrollImportRow,
} from '@finora/shared';
import { createDb } from '../db/client';
import { payrollAuditEvents, payrollEditProposals, payrollImportRows, payrollImports } from '../db/schema';
import { summarizePayrollRows, validatePayrollRow } from './attachment-extractor';

const PROPOSAL_TTL_MS = 10 * 60_000;

export class PayrollEditError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 404 | 409) { super(code); }
}

function snapshot(importRow: typeof payrollImports.$inferSelect, rows: PayrollImportRow[]) {
  const summary = summarizePayrollRows(rows);
  return { employeeCount: rows.length, total: summary.total, currency: summary.currency, status: importRow.status, blockingIssues: summary.blockingIssues, rows };
}

export function applyProposedChanges(rows: PayrollImportRow[], rawChanges: unknown[]) {
  const changes = rawChanges.map((change) => PayrollEditChangeSchema.parse(change));
  if (new Set(changes.map((change) => change.rowId)).size !== changes.length) {
    throw new PayrollEditError('payroll_duplicate_row_change', 400);
  }
  const byId = new Map(rows.map((row) => [row.rowId, row]));
  const next = new Map(byId);
  const resolved = changes.map((change) => {
    const before = byId.get(change.rowId);
    if (!before) throw new PayrollEditError('payroll_row_not_found', 404);
    if (change.operation === 'delete') { next.delete(change.rowId); return { ...change, before, after: null }; }
    const patch = PayrollEditPatchSchema.parse(change.patch);
    const after = validatePayrollRow(PayrollImportRowSchema.parse({ ...before, ...patch, rowId: before.rowId }));
    next.set(change.rowId, after);
    return { ...change, patch, before, after };
  });
  return { changes: resolved, rows: [...next.values()] };
}

async function ownedImport(databaseUrl: string, userId: string, importId: string) {
  const db = createDb(databaseUrl);
  const [item] = await db.select().from(payrollImports).where(and(eq(payrollImports.id, importId), eq(payrollImports.clerkUserId, userId), isNull(payrollImports.deletedAt))).limit(1);
  if (!item) throw new PayrollEditError('payroll_import_not_found', 404);
  const rawRows = await db.select({ payload: payrollImportRows.payload }).from(payrollImportRows).where(eq(payrollImportRows.importId, item.id));
  const rows = rawRows.map(({ payload }) => PayrollImportRowSchema.parse(payload));
  return { db, item, rows };
}

export async function listPayrollImportsForChat(databaseUrl: string, userId: string, input: { query?: string; importId?: string; limit: number }) {
  const db = createDb(databaseUrl);
  const imports = await db.select().from(payrollImports).where(and(eq(payrollImports.clerkUserId, userId), isNull(payrollImports.deletedAt))).orderBy(desc(payrollImports.updatedAt)).limit(50);
  const result = [];
  const normalizedQuery = input.query?.trim().toLowerCase();
  for (const item of imports.filter((candidate) => !input.importId || candidate.id === input.importId)) {
    const rawRows = await db.select({ payload: payrollImportRows.payload }).from(payrollImportRows).where(eq(payrollImportRows.importId, item.id));
    const allRows = rawRows.map(({ payload }) => PayrollImportRowSchema.parse(payload));
    const matchingRows = normalizedQuery ? allRows.filter((row) => [row.employeeName, row.employeeId].some((value) => value?.toLowerCase().includes(normalizedQuery))) : allRows;
    if (normalizedQuery && !matchingRows.length) continue;
    result.push({ importId: item.id, sourceName: item.sourceName, period: item.period, version: item.version, employeeCount: allRows.length, total: Number(item.total ?? 0), currency: item.currency, status: item.status, rows: matchingRows.slice(0, input.limit) });
    if (result.reduce((count, candidate) => count + candidate.rows.length, 0) >= input.limit) break;
  }
  return { imports: result };
}

export async function proposePayrollChanges(databaseUrl: string, userId: string, input: unknown) {
  const parsed = ProposePayrollChangesInputSchema.safeParse(input);
  if (!parsed.success) throw new PayrollEditError('payroll_changes_invalid', 400);
  const { db, item, rows } = await ownedImport(databaseUrl, userId, parsed.data.importId);
  const { changes, rows: afterRows } = applyProposedChanges(rows, parsed.data.changes);
  const beforeState = snapshot(item, rows);
  const afterSummary = summarizePayrollRows(afterRows);
  const afterState = { ...snapshot(item, afterRows), status: afterSummary.blockingIssues.length ? 'blocked' : 'ready' };
  const [proposal] = await db.insert(payrollEditProposals).values({ clerkUserId: userId, importId: item.id, baseVersion: item.version, changes, beforeState, afterState, expiresAt: new Date(Date.now() + PROPOSAL_TTL_MS) }).returning({ id: payrollEditProposals.id, expiresAt: payrollEditProposals.expiresAt });
  if (!proposal) throw new PayrollEditError('payroll_proposal_failed', 409);
  return { proposalId: proposal.id, importId: item.id, sourceName: item.sourceName, expiresAt: proposal.expiresAt.toISOString(), before: beforeState, after: afterState, changes };
}

export async function applyPayrollChanges(databaseUrl: string, userId: string, proposalId: string) {
  const db = createDb(databaseUrl);
  const [proposal] = await db.select().from(payrollEditProposals).where(and(eq(payrollEditProposals.id, proposalId), eq(payrollEditProposals.clerkUserId, userId))).limit(1);
  if (!proposal) throw new PayrollEditError('payroll_proposal_not_found', 404);
  if (proposal.status !== 'pending') throw new PayrollEditError('payroll_proposal_already_resolved', 409);
  if (proposal.expiresAt.getTime() <= Date.now()) { await db.update(payrollEditProposals).set({ status: 'expired' }).where(eq(payrollEditProposals.id, proposal.id)); throw new PayrollEditError('payroll_proposal_expired', 409); }
  const [item] = await db.select().from(payrollImports).where(and(eq(payrollImports.id, proposal.importId), eq(payrollImports.clerkUserId, userId), isNull(payrollImports.deletedAt))).limit(1);
  if (!item || item.version !== proposal.baseVersion) { await db.update(payrollEditProposals).set({ status: 'stale' }).where(eq(payrollEditProposals.id, proposal.id)); throw new PayrollEditError('payroll_proposal_stale', 409); }
  const rawRows = await db.select().from(payrollImportRows).where(eq(payrollImportRows.importId, item.id));
  const current = new Map(rawRows.map((row) => [row.rowId, PayrollImportRowSchema.parse(row.payload)]));
  for (const change of proposal.changes as Array<{ rowId: string; operation: 'update' | 'delete'; after?: PayrollImportRow | null }>) {
    if (change.operation === 'delete') current.delete(change.rowId);
    else if (change.after) current.set(change.rowId, PayrollImportRowSchema.parse(change.after));
  }
  const rows = [...current.values()];
  const summary = summarizePayrollRows(rows);
  const status = summary.blockingIssues.length ? 'blocked' : 'ready';
  const afterState = { ...snapshot(item, rows), status };
  const result = await db.$client.query(
    `with updated_import as (
       update payroll_imports
       set version = version + 1, status = $4::payroll_import_status, total = $5,
           currency = $6, blocking_issues = $7::jsonb, warnings = $8::jsonb, updated_at = now()
       where id = $1 and clerk_user_id = $2 and version = $3
       returning *
     ), deleted_rows as (
       delete from payroll_import_rows where import_id = $1 and exists (select 1 from updated_import)
     ), inserted_rows as (
       insert into payroll_import_rows (import_id, row_id, payload)
       select $1, value->>'rowId', value from jsonb_array_elements($9::jsonb) value
       where exists (select 1 from updated_import)
     ), resolved as (
       update payroll_edit_proposals set status = 'applied', applied_at = now()
       where id = $10 and clerk_user_id = $2 and status = 'pending' and exists (select 1 from updated_import)
     ), audited as (
       insert into payroll_audit_events (clerk_user_id, import_id, proposal_id, action, before_state, after_state, metadata)
       select $2, $1, $10, 'payroll_edit_applied', $11::jsonb, $12::jsonb, '{"source":"chat"}'::jsonb
       where exists (select 1 from updated_import)
     ) select * from updated_import`,
    [item.id, userId, item.version, status, String(summary.total), summary.currency, JSON.stringify(summary.blockingIssues), JSON.stringify(summary.warnings), JSON.stringify(rows), proposal.id, JSON.stringify(proposal.beforeState), JSON.stringify(afterState)],
  );
  const [updated] = result as unknown as Array<typeof payrollImports.$inferSelect>;
  if (!updated) throw new PayrollEditError('payroll_proposal_stale', 409);
  return { proposalId: proposal.id, importId: item.id, sourceName: updated.sourceName, ...snapshot(updated, rows), status: 'applied' as const };
}

export async function cancelPayrollProposal(databaseUrl: string, userId: string, proposalId: string) {
  const db = createDb(databaseUrl);
  const [cancelled] = await db.update(payrollEditProposals).set({ status: 'cancelled' }).where(and(eq(payrollEditProposals.id, proposalId), eq(payrollEditProposals.clerkUserId, userId), eq(payrollEditProposals.status, 'pending'))).returning({ id: payrollEditProposals.id });
  if (!cancelled) throw new PayrollEditError('payroll_proposal_not_pending', 409);
  return { proposalId, status: 'cancelled' as const };
}
