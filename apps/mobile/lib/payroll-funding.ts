import type { PayrollRun } from '@finora/shared';

import type { WalletItem } from '@/components/wallets/types';

import { executePayrollRun } from './payroll-api';
import { recordSentPayment } from './transactions-storage';
import {
  amountInWalletCurrency,
  creditWallet,
  debitWalletIn,
  InsufficientFundsError,
  listWallets,
} from './wallet-balances';

type GetToken = () => Promise<string | null>;

const ERROR_MESSAGES: Record<string, string> = {
  payroll_run_not_pending: 'This payroll was already paid or cancelled.',
  payroll_run_not_found: 'This payroll is no longer available.',
};

/** What paying `run` costs from `wallet`, in the wallet's currency (rounded to cents). */
export function payrollCostIn(wallet: WalletItem, run: Pick<PayrollRun, 'total' | 'currency'>) {
  return Math.round(amountInWalletCurrency(wallet, run.total, run.currency) * 100) / 100;
}

export function canFundPayroll(wallet: WalletItem, run: Pick<PayrollRun, 'total' | 'currency'>) {
  return payrollCostIn(wallet, run) <= wallet.balance;
}

/**
 * Pays an approved run: takes the total (converted, no fee) from the chosen
 * wallet, then executes it. If the API refuses, the money goes back. The run
 * is recorded in Activity as one payment.
 */
export async function payPayrollRun(getToken: GetToken, run: PayrollRun, walletId: string) {
  const wallet = (await listWallets()).find((item) => item.id === walletId);
  if (!wallet) throw new Error('Choose an account to pay from.');
  if (!canFundPayroll(wallet, run)) throw new InsufficientFundsError(wallet);

  const charged = await debitWalletIn(wallet.id, run.total, run.currency);
  let paid: PayrollRun;
  try {
    paid = await executePayrollRun(getToken, run.id, {
      fundingWalletId: wallet.id,
      fundingCurrency: wallet.currency,
      fundingAmount: Math.max(0.01, Math.round(charged.amount * 100) / 100),
    });
  } catch (error) {
    await creditWallet(wallet.id, charged.amount);
    const code = error instanceof Error ? error.message : '';
    throw new Error(ERROR_MESSAGES[code] ?? "Payroll couldn't be paid. Your balance wasn't changed.");
  }

  const people = paid.items.length;
  await recordSentPayment({
    transactionId: `payroll-${paid.id}`,
    payment: {
      amount: Math.round(charged.amount * 100) / 100,
      currency: wallet.currency,
      recipientName:
        paid.kind === 'single'
          ? (paid.items[0]?.employeeName ?? 'Employee')
          : `Payroll · ${people} ${people === 1 ? 'person' : 'people'}`,
      destination: { kind: 'internal_wallet', label: 'Payroll', value: paid.period ?? '' },
      reference: paid.period ? `Payroll ${paid.period}` : 'Payroll',
    },
  });
  return paid;
}
