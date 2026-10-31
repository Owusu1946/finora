import type { PreparedAction } from '@finora/shared';

import type { ApprovalRequest, ApprovalStatus } from '@/components/approvals/types';
import type { PaymentDestinationKind } from '@/components/chat/PaymentConfirmationCard';

import { cancelAction, executeAction, getAction, listActions } from './actions-api';

/**
 * The Approvals inbox: payments, conversions, and plans prepared on the Finora
 * API (by chat, automations, or an MCP agent) that wait for the user.
 */

const AGENT: Record<PreparedAction['source'], string> = {
  chat: 'Finora chat',
  manual: 'You',
  automation: 'Automation',
  mcp: 'AI agent (MCP)',
};

function approvalStatus(action: PreparedAction): ApprovalStatus {
  if (action.status === 'executed') return 'approved';
  if (action.status === 'pending_approval') return 'pending';
  return 'rejected';
}

const DESTINATION_KINDS: PaymentDestinationKind[] = [
  'mobile_money',
  'bank_account',
  'crypto_wallet',
  'internal_wallet',
];

function destinationKind(kind: string): PaymentDestinationKind {
  return (DESTINATION_KINDS as string[]).includes(kind)
    ? (kind as PaymentDestinationKind)
    : 'bank_account';
}

export function toApproval(action: PreparedAction): ApprovalRequest {
  const common = {
    id: action.id,
    status: approvalStatus(action),
    agent: AGENT[action.source],
    createdAt: action.createdAt,
    resolvedAt: action.executedAt ?? undefined,
    preparationId: action.id,
    transactionId: action.transactionId ?? undefined,
  };
  if (action.kind === 'plan') {
    return {
      ...common,
      kind: 'plan',
      plan: {
        planId: action.id,
        intent: action.title,
        currency: action.currency,
        total: action.amount,
        items: action.items.map((item) => ({
          kind: 'payment',
          label: item.title,
          amount: item.amount,
          currency: action.currency,
        })),
      },
    };
  }
  return {
    ...common,
    kind: 'payment',
    payment: {
      amount: action.amount,
      currency: action.currency,
      recipientName: action.recipient?.name ?? action.title,
      destination: action.recipient
        ? {
            kind: destinationKind(action.recipient.destination.kind),
            label: action.recipient.destination.label,
            value: action.recipient.destination.value,
          }
        : {
            kind: 'internal_wallet',
            label: 'Conversion',
            value: action.conversion ? `${action.conversion.toAmount} ${action.conversion.to}` : '',
          },
      ...(action.reference ? { reference: action.reference } : {}),
    },
  };
}

export async function listApprovals(): Promise<ApprovalRequest[]> {
  return (await listActions()).map(toApproval);
}

export async function getApproval(id: string): Promise<ApprovalRequest | null> {
  try {
    return toApproval(await getAction(id));
  } catch {
    return null;
  }
}

export async function countPendingApprovals(): Promise<number> {
  try {
    return (await listActions({ status: 'pending_approval' })).length;
  } catch {
    return 0;
  }
}

/**
 * Approves (executes) or rejects (cancels) an action. Call `approved` only
 * after the passcode.
 */
export async function resolveApproval(
  id: string,
  status: Extract<ApprovalStatus, 'approved' | 'rejected'>,
): Promise<ApprovalRequest> {
  return toApproval(status === 'approved' ? await executeAction(id) : await cancelAction(id));
}

/** Nothing is kept on the device; kept for the sign-out reset. */
export async function clearApprovals(): Promise<void> {}
