import {
  ImportPayeesRequestSchema,
  SavePayeeRequestSchema,
  UpdatePayeeRequestSchema,
  type Payee,
  type PayeeKind,
  type SavePayeeRequest,
  type UpdatePayeeRequest,
} from '@finora/shared';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '../db/client';

import { payees } from '../db/schema';
import { fromMinor, maskTail, toMinor } from '../ledger/ledger';

type PayeeRow = typeof payees.$inferSelect;

export class PayeeError extends Error {
  constructor(
    public readonly code: 'payee_not_found' | 'payees_already_imported',
    public readonly status: 404 | 409,
  ) {
    super(code);
    this.name = 'PayeeError';
  }
}

/** The identifier without spaces, dashes, or case, so one account is saved once. */
export function identifierKey(identifier: string) {
  return identifier.replace(/[\s-]+/g, '').toLowerCase();
}

export function toPayee(row: PayeeRow): Payee {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    currency: row.currency,
    method: row.method,
    label: row.label,
    identifier: row.identifier,
    country: row.country,
    defaultAmount: row.defaultAmountMinor == null ? null : fromMinor(row.defaultAmountMinor),
    notes: row.notes,
    favourite: row.favourite,
    lastPaidAt: row.lastPaidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A payee as the model sees it: the account number is masked. */
export function payeeForModel(payee: Payee) {
  return { ...payee, identifier: maskTail(payee.identifier) ?? '' };
}

function values(userId: string, input: SavePayeeRequest) {
  return {
    clerkUserId: userId,
    kind: input.kind,
    name: input.name,
    currency: input.currency.toUpperCase(),
    method: input.method,
    label: input.label,
    identifier: input.identifier,
    identifierKey: identifierKey(input.identifier),
    country: input.country?.toUpperCase() ?? null,
    defaultAmountMinor: input.defaultAmount == null ? null : toMinor(input.defaultAmount),
    notes: input.notes ?? null,
    favourite: input.favourite ?? false,
  };
}

export async function listPayees(
  db: Database,
  userId: string,
  filter: { kind?: PayeeKind; query?: string } = {},
) {
  const query = filter.query?.trim();
  const rows = await db
    .select()
    .from(payees)
    .where(
      and(
        eq(payees.clerkUserId, userId),
        filter.kind ? eq(payees.kind, filter.kind) : undefined,
        query
          ? or(
              ilike(payees.name, `%${query}%`),
              ilike(payees.label, `%${query}%`),
              eq(payees.identifierKey, identifierKey(query)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(payees.favourite), desc(payees.lastPaidAt), desc(payees.createdAt))
    .limit(200);
  return rows.map(toPayee);
}

export async function getPayee(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(payees)
    .where(and(eq(payees.clerkUserId, userId), eq(payees.id, id)))
    .limit(1);
  return row ? toPayee(row) : null;
}

/** Saves a payee, or updates the one already saved with the same account. */
export async function savePayee(db: Database, userId: string, request: SavePayeeRequest) {
  const input = SavePayeeRequestSchema.parse(request);
  const row = values(userId, input);
  const [saved] = await db
    .insert(payees)
    .values(row)
    .onConflictDoUpdate({
      target: [payees.clerkUserId, payees.kind, payees.identifierKey],
      set: {
        name: row.name,
        currency: row.currency,
        method: row.method,
        label: row.label,
        identifier: row.identifier,
        ...(input.country ? { country: row.country } : {}),
        ...(input.defaultAmount != null ? { defaultAmountMinor: row.defaultAmountMinor } : {}),
        ...(input.notes ? { notes: row.notes } : {}),
        ...(input.favourite != null ? { favourite: row.favourite } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();
  return toPayee(saved!);
}

export async function updatePayee(
  db: Database,
  userId: string,
  id: string,
  request: UpdatePayeeRequest,
) {
  const input = UpdatePayeeRequestSchema.parse(request);
  const [updated] = await db
    .update(payees)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
      ...(input.method ? { method: input.method } : {}),
      ...(input.label ? { label: input.label } : {}),
      ...(input.identifier
        ? { identifier: input.identifier, identifierKey: identifierKey(input.identifier) }
        : {}),
      ...(input.country ? { country: input.country.toUpperCase() } : {}),
      ...(input.defaultAmount != null ? { defaultAmountMinor: toMinor(input.defaultAmount) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.favourite != null ? { favourite: input.favourite } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(payees.clerkUserId, userId), eq(payees.id, id)))
    .returning();
  if (!updated) throw new PayeeError('payee_not_found', 404);
  return toPayee(updated);
}

export async function deletePayee(db: Database, userId: string, id: string) {
  const [deleted] = await db
    .delete(payees)
    .where(and(eq(payees.clerkUserId, userId), eq(payees.id, id)))
    .returning({ id: payees.id });
  if (!deleted) throw new PayeeError('payee_not_found', 404);
}

/** Copies the contacts the app saved on the device, once, while the user has none. */
export async function importPayees(db: Database, userId: string, request: unknown) {
  const { payees: items } = ImportPayeesRequestSchema.parse(request);
  const [existing] = await db
    .select({ id: payees.id })
    .from(payees)
    .where(eq(payees.clerkUserId, userId))
    .limit(1);
  if (existing) throw new PayeeError('payees_already_imported', 409);
  if (items.length) {
    await db
      .insert(payees)
      .values(items.map((item) => values(userId, item)))
      .onConflictDoNothing();
  }
  return listPayees(db, userId);
}

/** The saved payee paid at `identifier`, if any (for new-recipient checks). */
export async function findPayeeByIdentifier(db: Database, userId: string, identifier: string) {
  const key = identifierKey(identifier);
  if (!key) return null;
  const [row] = await db
    .select()
    .from(payees)
    .where(and(eq(payees.clerkUserId, userId), eq(payees.identifierKey, key)))
    .limit(1);
  return row ? toPayee(row) : null;
}

/** Marks saved payees with this account as just paid. Run alongside the payment. */
export function markPayeePaid(db: Database, userId: string, identifier: string, at: Date) {
  return db
    .update(payees)
    .set({ lastPaidAt: at })
    .where(
      and(eq(payees.clerkUserId, userId), eq(payees.identifierKey, identifierKey(identifier))),
    );
}
