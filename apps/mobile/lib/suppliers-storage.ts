import type { Payee } from '@finora/shared';

import type { PayoutDestination } from '@/lib/employees-storage';

import { listPayeesOfKind } from './payees-api';

/** Suppliers are saved payees on the Finora API, shared with chat and MCP. */
export type Supplier = {
  id: string;
  name: string;
  currency: string;
  defaultAmount?: number;
  destination: PayoutDestination;
  notes?: string;
};

function toSupplier(payee: Payee): Supplier {
  return {
    id: payee.id,
    name: payee.name,
    currency: payee.currency,
    defaultAmount: payee.defaultAmount ?? undefined,
    destination: {
      kind: payee.method === 'mobile_money' ? 'mobile_money' : 'bank_account',
      label: payee.label,
      value: payee.identifier,
    },
    notes: payee.notes ?? undefined,
  };
}

export async function listSuppliers(): Promise<Supplier[]> {
  return (await listPayeesOfKind('supplier')).map(toSupplier);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const suppliers = await listSuppliers();
  return suppliers.find((s) => s.id === id) ?? null;
}

export async function findSupplierByName(query: string): Promise<Supplier | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const suppliers = await listSuppliers();
  return (
    suppliers.find((s) => s.name.toLowerCase() === q) ??
    suppliers.find((s) => s.name.toLowerCase().includes(q)) ??
    suppliers.find((s) => q.includes(s.name.toLowerCase().split(/\s+/)[0] ?? '')) ??
    null
  );
}

/** Saved payees stay on the account; the payee cache is cleared with contacts. */
export async function clearSuppliers(): Promise<void> {}
