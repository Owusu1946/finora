import type {
  ApprovalPolicy,
  ApprovalPolicyKind,
  UpdateApprovalPolicyRequest,
} from '@finora/shared';

import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client';

import { approvalPolicies } from '../db/schema';
import { fromMinor, toMinor } from '../ledger/ledger';

type PolicyRow = typeof approvalPolicies.$inferSelect;

/** Every account starts with these; the user can turn them off or change the amounts. */
const DEFAULTS: { kind: ApprovalPolicyKind; amountUsd: number | null }[] = [
  { kind: 'amount_review', amountUsd: 500 },
  { kind: 'new_recipient', amountUsd: null },
  { kind: 'daily_limit', amountUsd: 10_000 },
];

export class PolicyError extends Error {
  constructor(public readonly code: 'policy_not_found') {
    super(code);
    this.name = 'PolicyError';
  }
}

function usd(amount: number) {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function toPolicy(row: PolicyRow): ApprovalPolicy {
  const amountUsd = row.amountUsdMinor == null ? null : fromMinor(row.amountUsdMinor);
  const copy: Record<ApprovalPolicyKind, { name: string; rule: string }> = {
    amount_review: {
      name: 'Review large payments',
      rule: `Payments over ${usd(amountUsd ?? 0)} are flagged for a second look before you approve.`,
    },
    new_recipient: {
      name: 'New recipients',
      rule: "The first payment to an account you haven't paid or saved is flagged.",
    },
    daily_limit: {
      name: 'Daily limit',
      rule: `Payments are blocked once they'd take today's total past ${usd(amountUsd ?? 0)}.`,
    },
  };
  return {
    id: row.id,
    kind: row.kind,
    ...copy[row.kind],
    enabled: row.enabled,
    amountUsd,
  };
}

/** The user's policies, creating the defaults the first time. */
export async function listPolicyRows(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(approvalPolicies)
    .where(eq(approvalPolicies.clerkUserId, userId));
  if (rows.length >= DEFAULTS.length) return rows;
  await db
    .insert(approvalPolicies)
    .values(
      DEFAULTS.map((policy) => ({
        clerkUserId: userId,
        kind: policy.kind,
        amountUsdMinor: policy.amountUsd == null ? null : toMinor(policy.amountUsd),
      })),
    )
    .onConflictDoNothing();
  return db.select().from(approvalPolicies).where(eq(approvalPolicies.clerkUserId, userId));
}

export async function listPolicies(db: Database, userId: string) {
  const order = DEFAULTS.map((policy) => policy.kind);
  return (await listPolicyRows(db, userId))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map(toPolicy);
}

export async function updatePolicy(
  db: Database,
  userId: string,
  id: string,
  input: UpdateApprovalPolicyRequest,
) {
  const [updated] = await db
    .update(approvalPolicies)
    .set({
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.amountUsd !== undefined ? { amountUsdMinor: toMinor(input.amountUsd) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(approvalPolicies.clerkUserId, userId), eq(approvalPolicies.id, id)))
    .returning();
  if (!updated) throw new PolicyError('policy_not_found');
  return toPolicy(updated);
}
