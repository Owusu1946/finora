import { convertDemoAmount, DEMO_CONVERSION_FEE_RATE, type LedgerWallet } from '@finora/shared';

export type PlannedCost = {
  /** Wallet the item is paid from. */
  walletId: string;
  /** What it takes from that wallet, in the wallet's currency. */
  amount: number;
};

export type PlannedConversion = {
  fromWalletId: string;
  from: string;
  to: string;
  /** What to convert, in `from`; after the fee it covers the shortfall. */
  amount: number;
};

const roundUp = (value: number) => Math.ceil(value * 100) / 100;

/**
 * Conversions that let every wallet cover what the plan takes from it, using
 * spare money in the user's other wallets (most spare first, at demo rates).
 * `uncovered` lists the wallets that still fall short, in their currency.
 */
export function planFunding(wallets: LedgerWallet[], costs: PlannedCost[]) {
  const need = new Map<string, number>();
  for (const cost of costs) need.set(cost.walletId, (need.get(cost.walletId) ?? 0) + cost.amount);
  const spare = new Map(
    wallets.map((wallet) => [wallet.id, wallet.balance - (need.get(wallet.id) ?? 0)]),
  );

  const conversions: PlannedConversion[] = [];
  const uncovered: { walletId: string; currency: string; amount: number }[] = [];
  for (const target of wallets) {
    let short = -(spare.get(target.id) ?? 0);
    if (short <= 0) continue;
    const sources = wallets
      .filter((wallet) => wallet.id !== target.id && (spare.get(wallet.id) ?? 0) > 0)
      .sort(
        (a, b) =>
          convertDemoAmount(spare.get(b.id)!, b.currency, 'USD') -
          convertDemoAmount(spare.get(a.id)!, a.currency, 'USD'),
      );
    for (const source of sources) {
      if (short <= 0) break;
      const available = spare.get(source.id)!;
      // Gross up for the conversion fee so what arrives covers the gap.
      const wanted = roundUp(
        convertDemoAmount(short, target.currency, source.currency) / (1 - DEMO_CONVERSION_FEE_RATE),
      );
      const amount = Math.min(wanted, Math.floor(available * 100) / 100);
      if (amount <= 0) continue;
      conversions.push({
        fromWalletId: source.id,
        from: source.currency,
        to: target.currency,
        amount,
      });
      spare.set(source.id, available - amount);
      short -= convertDemoAmount(
        amount * (1 - DEMO_CONVERSION_FEE_RATE),
        source.currency,
        target.currency,
      );
    }
    if (short > 0.005) {
      uncovered.push({
        walletId: target.id,
        currency: target.currency,
        amount: Math.round(short * 100) / 100,
      });
    }
  }
  return { conversions, uncovered };
}
