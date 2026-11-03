import type { Payee, SavePayeeRequest } from '@finora/shared';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SupportedCurrency } from '@/components/ui/currency-icon';

import { type Contact } from '@/components/contacts/types';

import { clearPayees, listPayeesOfKind, payeeMethodFor, savePayee } from './payees-api';
import { userStorageKey } from './session-storage';

/**
 * Contacts are saved payees on the Finora API, so "Pay Ama" works the same in
 * chat, the app, and MCP.
 */

/** Contacts the app kept before payees lived on the API; copied up once. */
const LEGACY_KEY = 'finora.contacts.v2';
/** Contacts the user saved have UUID ids; the seeded demo ones (`c-1`, ...) are skipped. */
const SAVED_ID = /^c-[0-9a-f]{8}-/i;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function toContact(payee: Payee): Contact {
  return {
    id: payee.id,
    name: payee.name,
    initials: initialsFromName(payee.name),
    currency: payee.currency as SupportedCurrency,
    method: payee.label,
    identifier: payee.identifier,
    favourite: payee.favourite,
    lastTxDate: payee.lastPaidAt,
  };
}

async function legacyContacts(): Promise<SavePayeeRequest[]> {
  const raw = await AsyncStorage.getItem(userStorageKey(LEGACY_KEY)).catch(() => null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Contact[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((contact) => SAVED_ID.test(contact.id) && !contact.identifier.includes('•'))
      .slice(0, 200)
      .map((contact) => ({
        kind: 'contact' as const,
        name: contact.name.slice(0, 120) || 'Contact',
        currency: contact.currency || 'USD',
        method: payeeMethodFor(contact.method),
        label: contact.method.slice(0, 80) || 'Payout',
        identifier: contact.identifier.slice(0, 120),
        favourite: contact.favourite,
      }));
  } catch {
    return [];
  }
}

export async function listContacts(): Promise<Contact[]> {
  return (await listPayeesOfKind('contact', legacyContacts)).map(toContact);
}

export async function findContactByIdentifier(identifier: string): Promise<Contact | null> {
  const contacts = await listContacts();
  const needle = identifier.replace(/[\s-]+/g, '').toLowerCase();
  return contacts.find((c) => c.identifier.replace(/[\s-]+/g, '').toLowerCase() === needle) ?? null;
}

export async function saveContact(input: {
  name: string;
  currency: string;
  method: string;
  identifier: string;
  favourite?: boolean;
}): Promise<Contact> {
  return toContact(
    await savePayee({
      kind: 'contact',
      name: input.name.trim().slice(0, 120) || 'Contact',
      currency: input.currency || 'USD',
      method: payeeMethodFor(input.method),
      label: input.method.slice(0, 80) || 'Payout',
      identifier: input.identifier.slice(0, 120),
      ...(input.favourite != null ? { favourite: input.favourite } : {}),
    }),
  );
}

export async function clearContacts(): Promise<void> {
  await clearPayees();
}
