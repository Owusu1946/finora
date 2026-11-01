import type { Payee, PrepareActionRequest } from '@finora/shared';

import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client';

import { invoices } from '../db/schema';
import { fromMinor } from '../ledger/ledger';
import { listPayees } from '../payees/payees';

type InvoiceRow = typeof invoices.$inferSelect;

export class InvoicePaymentError extends Error {
  constructor(
    public readonly code: 'invoice_not_found' | 'invoice_not_due' | 'invoice_destination_missing',
    public readonly status: 404 | 409,
  ) {
    super(code);
    this.name = 'InvoicePaymentError';
  }
}

/** The saved supplier an invoice's vendor name points to, if any. */
export function supplierForVendor(suppliers: Payee[], vendor: string) {
  const name = vendor.trim().toLowerCase();
  return (
    suppliers.find((item) => item.name.toLowerCase() === name) ??
    suppliers.find(
      (item) => item.name.toLowerCase().includes(name) || name.includes(item.name.toLowerCase()),
    ) ??
    null
  );
}

/**
 * A payment for an invoice, to the saved supplier that matches its vendor.
 * Gmail invoices carry no payout details, so without a supplier it can't be paid.
 */
export function invoicePaymentRequest(invoice: InvoiceRow, supplier: Payee): PrepareActionRequest {
  return {
    kind: 'payment',
    recipientName: supplier.name,
    amount: fromMinor(invoice.amountMinor),
    currency: invoice.currency,
    destination: { kind: supplier.method, label: supplier.label, value: supplier.identifier },
    reference: invoice.invoiceNumber,
    purpose: 'invoice',
    relatedId: `invoice:${invoice.id}`,
  };
}

/** The request to pay one of the user's invoices, or why it can't be paid. */
export async function invoicePaymentFor(db: Database, userId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.clerkUserId, userId), eq(invoices.id, invoiceId)))
    .limit(1)
    .catch(() => []);
  if (!invoice) throw new InvoicePaymentError('invoice_not_found', 404);
  if (invoice.status !== 'due' && invoice.status !== 'scheduled') {
    throw new InvoicePaymentError('invoice_not_due', 409);
  }
  const supplier = supplierForVendor(
    await listPayees(db, userId, { kind: 'supplier' }),
    invoice.vendor,
  );
  if (!supplier) throw new InvoicePaymentError('invoice_destination_missing', 409);
  return { invoice, request: invoicePaymentRequest(invoice, supplier) };
}
