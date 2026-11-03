import type {
  CreateFinancialPlanInputSchema,
  Payee,
  PreparePaymentInputSchema,
  PrepareActionRequest,
} from '@finora/shared';
import type { z } from 'zod';

/**
 * Turns the tool inputs chat and MCP agents send into action requests, so
 * both surfaces prepare money the same way.
 */

export function destinationLabel(kind: string) {
  if (kind === 'mobile_money') return 'Mobile money';
  if (kind === 'crypto_wallet') return 'Crypto wallet';
  return 'Bank account';
}

/** A payment, using the saved payee's account when one was picked. */
export function paymentRequestFromInput(
  input: z.infer<typeof PreparePaymentInputSchema>,
  saved: Payee | null,
): PrepareActionRequest {
  const kind = saved?.method ?? input.destinationKind ?? 'bank_account';
  return {
    kind: 'payment',
    recipientName:
      saved?.name ?? (input.recipientName?.trim() || input.accountName?.trim() || 'Recipient'),
    amount: input.amount.amount,
    currency: input.amount.currency,
    destination: {
      kind,
      label: saved?.label ?? (input.destinationLabel?.trim() || destinationLabel(kind)),
      value: (
        saved?.identifier ??
        input.destinationValue ??
        input.accountNumber ??
        input.iban ??
        ''
      ).slice(0, 120),
    },
    reference: input.reference,
    purpose: 'payment',
  };
}

/** A supplier payment to a saved supplier. */
export function supplierPaymentRequest(
  supplier: Payee,
  amount: { amount: number; currency: string },
  reference?: string,
): PrepareActionRequest {
  return {
    kind: 'payment',
    recipientName: supplier.name,
    amount: amount.amount,
    currency: amount.currency,
    destination: { kind: supplier.method, label: supplier.label, value: supplier.identifier },
    reference,
    purpose: 'supplier',
  };
}

/** The saved supplier named by id or exact name. */
export function findSupplier(
  suppliers: Payee[],
  input: { supplierId?: string; supplierName?: string },
) {
  const name = input.supplierName?.trim().toLowerCase();
  return (
    suppliers.find(
      (entry) =>
        (input.supplierId && entry.id === input.supplierId) ||
        (name !== undefined && entry.name.toLowerCase() === name),
    ) ?? null
  );
}

export class PlanInputError extends Error {
  constructor(
    public readonly code:
      | 'plan_items_required'
      | 'plan_item_amount_required'
      | 'plan_currency_mismatch',
  ) {
    super(code);
    this.name = 'PlanInputError';
  }
}

/** A single-currency plan with an amount on every item. */
export function planRequestFromInput(input: z.infer<typeof CreateFinancialPlanInputSchema>) {
  if (!input.items?.length) throw new PlanInputError('plan_items_required');
  if (input.items.some((item) => item.amount === undefined)) {
    throw new PlanInputError('plan_item_amount_required');
  }
  const currencies = new Set(input.items.map((item) => item.amount!.currency));
  if (currencies.size !== 1) throw new PlanInputError('plan_currency_mismatch');
  const currency = [...currencies][0]!;
  const items = input.items.map((item) => ({
    ...item,
    amount: item.amount!.amount,
    currency: item.amount!.currency,
  }));
  const request: PrepareActionRequest = {
    kind: 'plan',
    title: input.intent.slice(0, 120),
    currency,
    items: items.map((item) => ({
      title: (item.label ?? item.kind).slice(0, 120),
      amount: item.amount,
      category: item.kind,
    })),
  };
  return { request, items, currency, total: items.reduce((sum, item) => sum + item.amount, 0) };
}
