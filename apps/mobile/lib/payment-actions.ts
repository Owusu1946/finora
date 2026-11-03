import type { PrepareActionRequest } from '@finora/shared';

import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';

import { listWallets } from './wallet-balances';

type Purpose = 'payment' | 'supplier' | 'invoice' | 'bill' | 'transfer';

/** The wallet in `currency`, when the user has one. */
async function walletIn(currency: string | undefined) {
  if (!currency) return undefined;
  return (await listWallets()).find((wallet) => wallet.currency === currency)?.id;
}

/** A confirmed payment card as a payment action for the Finora API. */
export async function paymentActionRequest(
  payment: PaymentConfirmation,
  options: { purpose?: Purpose; relatedId?: string } = {},
): Promise<PrepareActionRequest> {
  const fundingWalletId = await walletIn(payment.fundingCurrency);
  return {
    kind: 'payment',
    recipientName: payment.recipientName.trim().slice(0, 120) || 'Recipient',
    amount: payment.amount,
    currency: payment.currency,
    destination: {
      kind: payment.destination.kind,
      label: (payment.settlementMethodLabel ?? payment.destination.label).slice(0, 80) || 'Payout',
      value: payment.destination.value.slice(0, 120),
    },
    ...(payment.reference ? { reference: payment.reference.slice(0, 140) } : {}),
    purpose: options.purpose ?? 'payment',
    ...(options.relatedId ? { relatedId: options.relatedId } : {}),
    ...(fundingWalletId ? { fundingWalletId } : {}),
  };
}
