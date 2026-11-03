import type { PayrollRun } from '@finora/shared';

import type { WalletItem } from '@/components/wallets/types';

import { executePayrollRun } from './payroll-api';
import {
  amountInWalletCurrency,
  InsufficientFundsError,
  listWallets,
  refreshAfterMoneyMoved,
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
 * Pays an approved run. Finora takes the total (converted, no fee) from the
 * chosen wallet and marks every payout sent in one step, so nothing is
 * charged unless the run is paid. It shows in Activity as one payment.
 */
export async function payPayrollRun(getToken: GetToken, run: PayrollRun, walletId: string) {
  const wallet = (await listWallets()).find((item) => item.id === walletId);
  if (!wallet) throw new Error('Choose an account to pay from.');
  if (!canFundPayroll(wallet, run)) throw new InsufficientFundsError(wallet);

  try {
    return await executePayrollRun(getToken, run.id, { fundingWalletId: wallet.id });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'insufficient_funds') throw new InsufficientFundsError(wallet);
    throw new Error(
      ERROR_MESSAGES[code] ?? "Payroll couldn't be paid. Your balance wasn't changed.",
    );
  } finally {
    await refreshAfterMoneyMoved();
  }
}
