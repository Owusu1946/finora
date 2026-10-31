import {
  PreparedActionListResponseSchema,
  PreparedActionResponseSchema,
  type PrepareActionRequest,
  type PreparedAction,
} from '@finora/shared';

import { LedgerApiError, ledgerRequest } from './ledger-api';
import { refreshAfterMoneyMoved } from './wallet-balances';

/**
 * Prepared payments, conversions, and plans on the Finora API. Money moves
 * only when `executeAction` runs, which callers do after the passcode.
 */

const MESSAGES: Record<string, string> = {
  action_not_pending: 'This was already approved or cancelled.',
  action_not_found: 'This is no longer available.',
  already_paid: 'This was already paid.',
  wallet_not_found: 'That account is no longer available.',
};

/** A message for the user from a failed action request. */
export function actionErrorMessage(error: unknown) {
  if (!(error instanceof LedgerApiError)) {
    return error instanceof Error ? error.message : 'Something went wrong. Try again.';
  }
  if (error.code === 'insufficient_funds') {
    const currency = typeof error.details.currency === 'string' ? `${error.details.currency} ` : '';
    return `Not enough in your ${currency}wallet. Nothing was sent.`;
  }
  if (error.code === 'conversion_wallet_missing') {
    return `You don't have a ${String(error.details.currency ?? '')} wallet to convert with.`;
  }
  if (error.code === 'action_blocked') {
    const reasons = Array.isArray(error.details.reasons) ? error.details.reasons.join(' ') : '';
    return reasons || 'Your policies block this payment.';
  }
  return (error.code && MESSAGES[error.code]) || error.message;
}

export async function prepareAction(request: PrepareActionRequest) {
  return PreparedActionResponseSchema.parse(
    await ledgerRequest('/actions', { method: 'POST', body: request }),
  ).action;
}

/** Replaces a pending action's details after the user edited them. */
export async function updateAction(id: string, request: PrepareActionRequest) {
  return PreparedActionResponseSchema.parse(
    await ledgerRequest(`/actions/${encodeURIComponent(id)}`, { method: 'PUT', body: request }),
  ).action;
}

export async function getAction(id: string) {
  return PreparedActionResponseSchema.parse(
    await ledgerRequest(`/actions/${encodeURIComponent(id)}`),
  ).action;
}

export async function listActions(filter: { status?: string; relatedId?: string } = {}) {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.relatedId) params.set('relatedId', filter.relatedId);
  const suffix = params.size ? `?${params.toString()}` : '';
  return PreparedActionListResponseSchema.parse(await ledgerRequest(`/actions${suffix}`)).actions;
}

/** The executed action that paid an invoice, bill, or request, if any. */
export async function findPaidAction(relatedId: string): Promise<PreparedAction | null> {
  const actions = await listActions({ status: 'executed', relatedId }).catch(() => []);
  return actions[0] ?? null;
}

/** Executes an approved action, then refreshes balances and Activity. */
export async function executeAction(id: string, options: { fundingWalletId?: string } = {}) {
  try {
    return PreparedActionResponseSchema.parse(
      await ledgerRequest(`/actions/${encodeURIComponent(id)}/execute`, {
        method: 'POST',
        body: options,
      }),
    ).action;
  } finally {
    await refreshAfterMoneyMoved();
  }
}

export async function cancelAction(id: string) {
  return PreparedActionResponseSchema.parse(
    await ledgerRequest(`/actions/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  ).action;
}

/**
 * For money the user starts in the app (not from a chat card): prepares the
 * action, asks `approve` (the passcode) once it passed the checks, then
 * executes it. Resolves null when the user backs out at the passcode.
 */
export async function prepareApproveAndExecute(
  request: PrepareActionRequest,
  approve: () => Promise<boolean>,
) {
  const action = await prepareAction(request);
  if (!(await approve())) {
    await cancelAction(action.id).catch(() => undefined);
    return null;
  }
  return executeAction(action.id);
}
