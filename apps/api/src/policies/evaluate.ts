import { convertDemoAmount, type ApprovalPolicy, type PolicyResult } from '@finora/shared';
import { and, eq, gte, sql } from 'drizzle-orm';

import type { Database } from '../db/client';

import { ledgerTransactions, preparedActions } from '../db/schema';
import { fromMinor } from '../ledger/ledger';
import { findPayeeByIdentifier, identifierKey } from '../payees/payees';
import { listPolicies } from './policies';

export type PolicyCheck = {
  kind: 'payment' | 'conversion' | 'plan';
  amount: number;
  currency: string;
  /** Payment destination (account, phone, or address), for new-recipient rules. */
  recipient: string | null;
};

/** What the user's enabled policies say about one action, given the facts. */
export function applyPolicies(
  policies: ApprovalPolicy[],
  facts: { amountUsd: number; sentTodayUsd: number; isNewRecipient: boolean; isOutflow: boolean },
): PolicyResult {
  if (!facts.isOutflow) return { outcome: 'allowed', reasons: [] };
  const usd = (amount: number) =>
    `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const blocked: string[] = [];
  const review: string[] = [];
  for (const policy of policies) {
    if (!policy.enabled) continue;
    if (policy.kind === 'daily_limit' && policy.amountUsd != null) {
      if (facts.sentTodayUsd + facts.amountUsd > policy.amountUsd) {
        blocked.push(
          `This would take today's payments past your ${usd(policy.amountUsd)} daily limit.`,
        );
      }
    }
    if (policy.kind === 'amount_review' && policy.amountUsd != null) {
      if (facts.amountUsd > policy.amountUsd) {
        review.push(`It's over your ${usd(policy.amountUsd)} review amount.`);
      }
    }
    if (policy.kind === 'new_recipient' && facts.isNewRecipient) {
      review.push("You haven't paid this account before.");
    }
  }
  if (blocked.length) return { outcome: 'blocked', reasons: [...blocked, ...review] };
  if (review.length) return { outcome: 'needs_review', reasons: review };
  return { outcome: 'allowed', reasons: [] };
}

/** Money sent today (UTC), in USD at demo rates. */
async function sentTodayUsd(db: Database, userId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .select({
      currency: ledgerTransactions.currency,
      total: sql<number>`coalesce(sum(${ledgerTransactions.amountMinor}), 0)::float8`,
    })
    .from(ledgerTransactions)
    .where(
      and(
        eq(ledgerTransactions.clerkUserId, userId),
        eq(ledgerTransactions.direction, 'sent'),
        gte(ledgerTransactions.createdAt, start),
      ),
    )
    .groupBy(ledgerTransactions.currency);
  return rows.reduce(
    (sum, row) => sum + convertDemoAmount(fromMinor(Number(row.total)), row.currency, 'USD'),
    0,
  );
}

/** True when the account is neither saved nor paid before. */
async function isNewRecipient(db: Database, userId: string, recipient: string | null) {
  const key = recipient ? identifierKey(recipient) : '';
  if (!key) return false;
  if (await findPayeeByIdentifier(db, userId, recipient!)) return false;
  const [paid] = await db
    .select({ id: preparedActions.id })
    .from(preparedActions)
    .where(
      and(
        eq(preparedActions.clerkUserId, userId),
        eq(preparedActions.status, 'executed'),
        sql`regexp_replace(lower(${preparedActions.payload}->'destination'->>'value'), '[[:space:]-]+', '', 'g') = ${key}`,
      ),
    )
    .limit(1);
  return !paid;
}

/**
 * Checks an action against the user's approval policies. Policies only block
 * or flag: every action still needs the passcode.
 */
export async function evaluateActionPolicy(
  db: Database,
  userId: string,
  check: PolicyCheck,
): Promise<PolicyResult> {
  const isOutflow = check.kind !== 'conversion';
  if (!isOutflow) return { outcome: 'allowed', reasons: [] };
  const [policies, sentToday, isNew] = await Promise.all([
    listPolicies(db, userId),
    sentTodayUsd(db, userId),
    check.kind === 'payment' ? isNewRecipient(db, userId, check.recipient) : false,
  ]);
  return applyPolicies(policies, {
    amountUsd: convertDemoAmount(check.amount, check.currency, 'USD'),
    sentTodayUsd: sentToday,
    isNewRecipient: isNew,
    isOutflow,
  });
}
