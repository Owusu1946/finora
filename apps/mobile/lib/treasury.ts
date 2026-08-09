import { INITIAL_WALLETS_DATA } from '@/components/wallets/types';
import { listUpcomingCalendarMoneyEvents } from '@/lib/calendar-events-storage';
import { listActiveEmployees } from '@/lib/employees-storage';
import { listDueInvoices } from '@/lib/invoices-storage';
import { listOpenSmsPaymentRequests } from '@/lib/sms-requests-storage';
import { listSuppliers } from '@/lib/suppliers-storage';

export type TreasuryBalance = {
  currency: string;
  balance: number;
  usdEquivalent: number;
};

export type TreasuryOverview = {
  totalUsd: number;
  balances: TreasuryBalance[];
  upcomingOutflows: {
    label: string;
    amount: number;
    currency: string;
    kind: string;
  }[];
  notes: string[];
};

/** Aggregate mock treasury view from existing local stores (no WeWire). */
export async function getTreasuryOverview(): Promise<TreasuryOverview> {
  const balances: TreasuryBalance[] = INITIAL_WALLETS_DATA.map((w) => ({
    currency: w.currency,
    balance: w.balance,
    usdEquivalent: w.usdEquivalent,
  }));
  const totalUsd = balances.reduce((s, b) => s + b.usdEquivalent, 0);

  const [employees, invoices, suppliers, calendar, sms] = await Promise.all([
    listActiveEmployees(),
    listDueInvoices(),
    listSuppliers(),
    listUpcomingCalendarMoneyEvents(),
    listOpenSmsPaymentRequests(),
  ]);

  const payrollTotal = employees.reduce((s, e) => s + e.salary, 0);
  const upcomingOutflows = [
    ...(payrollTotal > 0
      ? [
          {
            label: 'Next payroll',
            amount: payrollTotal,
            currency: employees[0]?.currency ?? 'USD',
            kind: 'payroll',
          },
        ]
      : []),
    ...invoices.slice(0, 3).map((inv) => ({
      label: `${inv.vendor} · ${inv.invoiceNumber}`,
      amount: inv.amount,
      currency: inv.currency,
      kind: 'invoice',
    })),
    ...suppliers
      .filter((s) => s.defaultAmount != null)
      .slice(0, 2)
      .map((s) => ({
        label: s.name,
        amount: s.defaultAmount!,
        currency: s.currency,
        kind: 'supplier',
      })),
    ...calendar
      .filter((e) => e.amount != null && e.currency)
      .slice(0, 2)
      .map((e) => ({
        label: e.title,
        amount: e.amount!,
        currency: e.currency!,
        kind: 'calendar',
      })),
    ...sms
      .filter((r) => r.amount != null && r.currency)
      .slice(0, 1)
      .map((r) => ({
        label: `SMS · ${r.fromName}`,
        amount: r.amount!,
        currency: r.currency!,
        kind: 'sms',
      })),
  ];

  const usdWallet = balances.find((b) => b.currency === 'USD');
  const notes: string[] = [];
  if (usdWallet && usdWallet.balance < 10000) {
    notes.push('USD operating balance is below the GHS 10,000 / ~$10k float target.');
  }
  if (payrollTotal > 0) {
    notes.push(`Payroll for ${employees.length} employees is ready to prepare.`);
  }
  if (invoices.length > 0) {
    notes.push(`${invoices.length} supplier invoice${invoices.length === 1 ? '' : 's'} still due.`);
  }

  return { totalUsd, balances, upcomingOutflows, notes };
}
