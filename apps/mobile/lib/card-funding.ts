import { VIRTUAL_CARD_ISSUE_FEE_USD } from '@finora/shared';

import type { VirtualCard } from '@/components/cards/types';
import type { WalletItem } from '@/components/wallets/types';

import { createVirtualCard, topUpVirtualCard } from './virtual-cards-storage';
import {
  InsufficientFundsError,
  listWallets,
  refreshAfterMoneyMoved,
  usdInWalletCurrency,
} from './wallet-balances';

/** How a wallet is described as a funding source. */
export function fundingSourceKind(wallet: WalletItem) {
  if (wallet.type === 'momo') return 'Mobile money';
  if (wallet.type === 'crypto') return 'WeWire wallet';
  return 'Bank account';
}

/** Total charged to the funding account to load or top up `amountUsd` (amount + $1 fee). */
export function cardFundingTotalUsd(amountUsd: number) {
  return amountUsd + VIRTUAL_CARD_ISSUE_FEE_USD;
}

/** Whether a wallet can cover loading `amountUsd` onto a card plus the issue fee. */
export function canFundCard(wallet: WalletItem, amountUsd: number) {
  return usdInWalletCurrency(wallet, cardFundingTotalUsd(amountUsd)) <= wallet.balance;
}

/**
 * Issues a prepaid USD card loaded with `amountUsd` (its lifetime spend limit).
 * Finora charges the chosen wallet that amount plus the $1 issue fee,
 * converted to the wallet's currency, and records it in Activity.
 */
export async function fundAndIssueCard(input: {
  label: string;
  amountUsd: number;
  walletId: string;
  /** False when the caller shows its own confirmation (skips the "Card ready" popup). */
  announce?: boolean;
}): Promise<VirtualCard> {
  const wallet = (await listWallets()).find((item) => item.id === input.walletId);
  if (!wallet) throw new Error('Choose an account to fund the card.');
  if (!canFundCard(wallet, input.amountUsd)) throw new InsufficientFundsError(wallet);

  try {
    return await createVirtualCard(
      { label: input.label, spendLimit: input.amountUsd, fundingWalletId: wallet.id },
      { announce: input.announce },
    );
  } finally {
    await refreshAfterMoneyMoved();
  }
}

/**
 * Adds `amountUsd` to a prepaid card. Finora charges the chosen wallet that
 * amount plus the $1 fee, converted to the wallet's currency.
 */
export async function topUpCard(input: {
  card: VirtualCard;
  amountUsd: number;
  walletId: string;
}): Promise<VirtualCard> {
  const wallet = (await listWallets()).find((item) => item.id === input.walletId);
  if (!wallet) throw new Error('Choose an account to top up from.');
  if (!canFundCard(wallet, input.amountUsd)) throw new InsufficientFundsError(wallet);

  try {
    return await topUpVirtualCard(input.card.id, input.amountUsd, wallet.id);
  } finally {
    await refreshAfterMoneyMoved();
  }
}
