import { describe, expect, it } from 'vitest';

import { maskDestination, toPayrollRun } from './prepare-import';

const created = new Date('2026-10-30T10:00:00.000Z');

const run = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'user_1',
  importId: '22222222-2222-4222-8222-222222222222',
  kind: 'payroll' as const,
  period: 'October 2026',
  currency: 'GHS',
  totalMinor: 350_050,
  status: 'pending_approval' as const,
  mode: 'demo' as const,
  fundingWalletId: null,
  fundingCurrency: null,
  fundingAmountMinor: null,
  approvedAt: null,
  executedAt: null,
  createdAt: created,
  updatedAt: created,
};

function item(position: number, name: string, amountMinor: number) {
  return {
    id: `item-${position}`,
    runId: run.id,
    position,
    rowId: `row-${position + 1}`,
    employeeName: name,
    employeeId: null,
    role: 'Sales',
    amountMinor,
    destinationKind: 'mobile_money',
    destinationLabel: 'MTN MoMo',
    destinationValue: '024 123 4567',
    reference: null,
    status: 'pending' as const,
    failureReason: null,
    sentAt: null,
  };
}

describe('maskDestination', () => {
  it('keeps only the last four characters', () => {
    expect(maskDestination('024 123 4567')).toBe('•••• 4567');
    expect(maskDestination('GH12 3456 7890 1234')).toBe('•••• 1234');
    expect(maskDestination('123')).toBe('123');
  });
});

describe('toPayrollRun', () => {
  it('converts minor units, orders items, and masks destinations', () => {
    const result = toPayrollRun(run, [item(1, 'Kofi', 150_050), item(0, 'Ama', 200_000)]);
    expect(result).toMatchObject({
      id: run.id,
      total: 3_500.5,
      status: 'pending_approval',
      mode: 'demo',
      funding: null,
      createdAt: '2026-10-30T10:00:00.000Z',
      executedAt: null,
    });
    expect(result.items.map((entry) => [entry.employeeName, entry.amount])).toEqual([
      ['Ama', 2_000],
      ['Kofi', 1_500.5],
    ]);
    expect(result.items[0]!.destination).toEqual({
      kind: 'mobile_money',
      label: 'MTN MoMo',
      value: '•••• 4567',
    });
  });

  it('reports the funding once executed', () => {
    const result = toPayrollRun(
      {
        ...run,
        status: 'completed',
        fundingWalletId: 'w-usd',
        fundingCurrency: 'USD',
        fundingAmountMinor: 22_753,
        executedAt: created,
      },
      [],
    );
    expect(result.funding).toEqual({ walletId: 'w-usd', currency: 'USD', amount: 227.53 });
    expect(result.executedAt).toBe('2026-10-30T10:00:00.000Z');
  });
});
