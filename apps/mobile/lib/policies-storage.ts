import type { ApprovalPolicy } from '@finora/shared';

import { listApprovalPolicies, updateApprovalPolicy } from './payees-api';

/**
 * Approval policies live on the Finora API, which checks every payment
 * against them. They flag or block; the passcode is always required.
 */
export type { ApprovalPolicy };

let cached: ApprovalPolicy[] = [];

export async function listPolicies(): Promise<ApprovalPolicy[]> {
  try {
    cached = await listApprovalPolicies();
  } catch (error) {
    if (__DEV__) console.warn('[policies] load failed', error);
  }
  return cached;
}

export async function setPolicyEnabled(
  id: string,
  enabled: boolean,
): Promise<ApprovalPolicy | null> {
  try {
    const policy = await updateApprovalPolicy(id, { enabled });
    cached = cached.map((item) => (item.id === id ? policy : item));
    return policy;
  } catch {
    return null;
  }
}

export async function setPolicyAmount(id: string, amountUsd: number) {
  const policy = await updateApprovalPolicy(id, { amountUsd });
  cached = cached.map((item) => (item.id === id ? policy : item));
  return policy;
}

/** What the policies would say, for the offline demo chat (the API decides for real). */
export function simulatePolicy(
  policies: ApprovalPolicy[],
  amountUsd: number,
  isNewRecipient: boolean,
) {
  const active = policies.filter((p) => p.enabled);
  const hits: string[] = [];
  for (const policy of active) {
    if (policy.kind === 'amount_review' && amountUsd > (policy.amountUsd ?? Infinity)) {
      hits.push(policy.name);
    }
    if (policy.kind === 'new_recipient' && isNewRecipient) hits.push(policy.name);
  }
  return { requiresApproval: true, matched: hits };
}

export async function clearPolicies(): Promise<void> {
  cached = [];
}
