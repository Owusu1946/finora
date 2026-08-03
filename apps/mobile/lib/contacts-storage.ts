import AsyncStorage from '@react-native-async-storage/async-storage';

import { MOCK_CONTACTS, type Contact } from '@/components/contacts/types';
import type { SupportedCurrency } from '@/components/ui/currency-icon';

const KEY = 'finora.contacts.v2';

const memory = new Map<string, string>();

async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Still valid for this process via memory.
  }
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export async function listContacts(): Promise<Contact[]> {
  const raw = await getItem(KEY);
  if (!raw) {
    await setItem(KEY, JSON.stringify(MOCK_CONTACTS));
    return [...MOCK_CONTACTS];
  }
  try {
    const parsed = JSON.parse(raw) as Contact[];
    return Array.isArray(parsed) ? parsed : [...MOCK_CONTACTS];
  } catch {
    return [...MOCK_CONTACTS];
  }
}

export async function findContactByIdentifier(identifier: string): Promise<Contact | null> {
  const contacts = await listContacts();
  const needle = identifier.replace(/\s+/g, '').toLowerCase();
  return (
    contacts.find((c) => c.identifier.replace(/\s+/g, '').toLowerCase() === needle) ?? null
  );
}

export async function saveContact(input: {
  name: string;
  currency: string;
  method: string;
  identifier: string;
  favourite?: boolean;
}): Promise<Contact> {
  const contacts = await listContacts();
  const existing = await findContactByIdentifier(input.identifier);
  if (existing) {
    const updated: Contact = {
      ...existing,
      name: input.name || existing.name,
      method: input.method || existing.method,
      currency: (input.currency as SupportedCurrency) || existing.currency,
      lastTxDate: new Date().toISOString(),
    };
    const next = contacts.map((c) => (c.id === existing.id ? updated : c));
    await setItem(KEY, JSON.stringify(next));
    return updated;
  }

  const contact: Contact = {
    id: `c-${Date.now()}`,
    name: input.name.trim() || 'Contact',
    initials: initialsFromName(input.name),
    currency: (input.currency as SupportedCurrency) || 'USD',
    method: input.method,
    identifier: input.identifier,
    favourite: input.favourite ?? false,
    lastTxDate: new Date().toISOString(),
  };
  await setItem(KEY, JSON.stringify([contact, ...contacts]));
  return contact;
}

export async function clearContacts(): Promise<void> {
  memory.delete(KEY);
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
