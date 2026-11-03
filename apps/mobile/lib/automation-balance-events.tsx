import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';

import { postBalanceEvent } from './automations-api';
import { listWallets, subscribeWallets } from './wallet-balances';

/** Waits for a burst of balance changes (debit plus fee) to settle before reporting. */
const SETTLE_MS = 1_500;

/**
 * Wallet balances live on the device until WeWire is live, so the app reports
 * each change to the API. That's what sets off "balance below / above" automations.
 */
export function AutomationBalanceBridge() {
  const { getToken, isSignedIn, userId } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Balances already reported, so startup and unrelated saves send nothing.
    const reported = new Map<string, number>();

    const report = async (initial: boolean) => {
      const wallets = await listWallets().catch(() => []);
      for (const wallet of wallets) {
        const previous = reported.get(wallet.id);
        reported.set(wallet.id, wallet.balance);
        if (disposed || initial || previous === wallet.balance) continue;
        await postBalanceEvent(() => getTokenRef.current(), {
          walletId: wallet.id,
          currency: wallet.currency,
          balance: Math.max(0, wallet.balance),
        }).catch((error: unknown) => {
          console.warn('[automations] could not report a balance change', error);
        });
      }
    };

    void report(true);
    const unsubscribe = subscribeWallets(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void report(false), SETTLE_MS);
    });
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [isSignedIn, userId]);

  return null;
}
