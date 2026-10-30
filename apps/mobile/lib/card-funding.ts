import { VIRTUAL_CARD_ISSUE_FEE_USD } from '@finora/shared';

import type { VirtualCard } from '@/components/cards/types';
import type { WalletItem } from '@/components/wallets/types';

import { recordSentPayment } from './transactions-storage';
import { createVirtualCard, setVirtualCardStatus } from './virtual-cards-storage';
import {
  debitWallet,
  InsufficientFundsError,
  listWallets,
  usdInWalletCurrency,
} from './wallet-balances';

/** How a wallet is described as a funding source. */
export function fundingSourceKind(wallet: WalletItem) {
  if (wallet.type === 'momo') return 'Mobile money';
  if (wallet.type === 'crypto') return 'WeWire wallet';
  return 'Bank account';
}

/** Total charged to the funding account for a card loaded with `amountUsd`. */
export function cardFundingTotalUsd(amountUsd: number) {
  return amountUsd + VIRTUAL_CARD_ISSUE_FEE_USD;
}

/** Whether a wallet can cover loading `amountUsd` onto a card plus the issue fee. */
export function canFundCard(wallet: WalletItem, amountUsd: number) {
  return usdInWalletCurrency(wallet, cardFundingTotalUsd(amountUsd)) <= wallet.balance;
}

/**
 * Issues a prepaid USD card loaded with `amountUsd` (its lifetime spend limit)
 * and charges the chosen wallet that amount plus the $1 issue fee, converted to
 * the wallet's currency. Records the charge in Activity.
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

  const card = await createVirtualCard(
    { label: input.label, spendLimit: input.amountUsd },
    { announce: input.announce },
  );

  let charged: Awaited<ReturnType<typeof debitWallet>>;
  try {
    charged = await debitWallet(wallet.id, cardFundingTotalUsd(input.amountUsd));
  } catch (error) {
    // The balance changed since the check: never leave an unfunded card live.
    await setVirtualCardStatus(card.id, 'cancelled');
    throw error;
  }

  await recordSentPayment({
    transactionId: card.id,
    payment: {
      amount: Math.round(charged.amount * 100) / 100,
      currency: wallet.currency,
      recipientName: `${card.label} card`,
      destination: { kind: 'internal_wallet', label: 'Virtual card', value: `•••• ${card.last4}` },
      reference: `Card load $${input.amountUsd} + $${VIRTUAL_CARD_ISSUE_FEE_USD} issue fee`,
    },
  });
  return card;
}
