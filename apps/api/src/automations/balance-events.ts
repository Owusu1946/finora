import type { Database } from '../db/client';
import type { AutomationQueueMessage } from './queue';

import { listActiveAutomationsForUser } from '../db/automation-store';
import { listLedgerWallets } from '../ledger/ledger';

/**
 * After money moves on the ledger, queues the user's "balance below / above"
 * automations with the new balance of the wallet each one watches.
 */
export async function queueBalanceEvents(
  queue: Queue,
  db: Database,
  userId: string,
  transactionId: string,
) {
  const automations = (await listActiveAutomationsForUser(db, userId)).filter(
    (row) => row.trigger.type === 'balance_threshold',
  );
  if (!automations.length) return 0;
  const { wallets } = await listLedgerWallets(db, userId);
  let queued = 0;
  for (const row of automations) {
    if (row.trigger.type !== 'balance_threshold') continue;
    const { currency, walletId } = row.trigger.config;
    const wallet = wallets.find((item) =>
      walletId ? item.id === walletId : item.currency === currency,
    );
    if (!wallet) continue;
    await queue.send({
      kind: 'evaluate',
      automationId: row.id,
      eventId: `balance:${wallet.id}:${transactionId}:${row.id}`,
      context: { currency: wallet.currency as never, walletBalance: wallet.balance },
    } satisfies AutomationQueueMessage);
    queued += 1;
  }
  return queued;
}

/** Fire-and-forget version for routes: never fails the request that moved the money. */
export function afterMoneyMoved(
  ctx: { waitUntil: (promise: Promise<unknown>) => void },
  queue: Queue,
  db: Database,
  userId: string,
  transactionId: string | null | undefined,
) {
  if (!transactionId) return;
  ctx.waitUntil(
    queueBalanceEvents(queue, db, userId, transactionId).catch((error) => {
      console.error('[automations:balance-events]', {
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }),
  );
}
