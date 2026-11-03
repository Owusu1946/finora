import type { Payee } from '@finora/shared';

import { describe, expect, it } from 'vitest';

import { supplierForVendor } from './invoices';

function supplier(name: string): Payee {
  return {
    id: name,
    kind: 'supplier',
    name,
    currency: 'USD',
    method: 'bank_account',
    label: 'Bank',
    identifier: '12345678',
    country: null,
    defaultAmount: null,
    notes: null,
    favourite: false,
    lastPaidAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
}

describe('supplierForVendor', () => {
  const suppliers = [supplier('Amazon Web Services'), supplier('Acme'), supplier('Acme Logistics')];

  it('prefers an exact name, then a partial one', () => {
    expect(supplierForVendor(suppliers, 'acme')?.name).toBe('Acme');
    expect(supplierForVendor(suppliers, 'Amazon Web Services EMEA')?.name).toBe(
      'Amazon Web Services',
    );
  });

  it('finds nothing for an unknown vendor', () => {
    expect(supplierForVendor(suppliers, 'Vercel')).toBeNull();
  });
});
