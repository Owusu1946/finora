import type { PolicyResult } from '@finora/shared';

import type { Database } from '../db/client';

export type PolicyCheck = {
  kind: 'payment' | 'conversion' | 'plan';
  amount: number;
  currency: string;
  /** Payment destination (account, phone, or address), for new-recipient rules. */
  recipient: string | null;
};

/**
 * Checks an action against the user's approval policies before it is stored.
 * Policies only block or flag: every action still needs the passcode.
 * Server-side policies are not stored yet, so everything is allowed for now.
 */
export async function evaluateActionPolicy(
  _db: Database,
  _userId: string,
  _check: PolicyCheck,
): Promise<PolicyResult> {
  return { outcome: 'allowed', reasons: [] };
}
