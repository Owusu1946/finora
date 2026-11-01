import { TreasuryOverviewResponseSchema, type TreasuryOverview } from '@finora/shared';

import { ledgerRequest } from './ledger-api';

export type { TreasuryOverview };
export type TreasuryBalance = TreasuryOverview['balances'][number];

let cached: TreasuryOverview | null = null;

/**
 * The treasury view from the Finora API: ledger balances, bills due in the
 * next 30 days (recurring payments, invoices, next payroll), and the forecast.
 * Falls back to the last view when Finora can't be reached.
 */
export async function getTreasuryOverview(): Promise<TreasuryOverview> {
  try {
    cached = TreasuryOverviewResponseSchema.parse(
      await ledgerRequest('/insights/treasury'),
    ).overview;
    return cached;
  } catch (error) {
    if (__DEV__) console.warn('[treasury] load failed', error);
    return (
      cached ?? {
        totalUsd: 0,
        balances: [],
        upcomingOutflows: [],
        notes: ["Couldn't reach Finora. Open Treasury again to retry."],
      }
    );
  }
}
