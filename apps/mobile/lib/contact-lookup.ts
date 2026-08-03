import type { Contact } from '@/components/contacts/types';
import { listContacts } from '@/lib/contacts-storage';

/** Match contacts by first name, last name, or full name substring. */
export async function findContactsByName(query: string): Promise<Contact[]> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];
  const contacts = await listContacts();
  return contacts.filter((c) => {
    const name = c.name.toLowerCase();
    if (name.includes(q)) return true;
    return name.split(/\s+/).some((part) => part.startsWith(q));
  });
}

export function contactToPaymentDestination(contact: Contact): {
  kind: 'mobile_money' | 'bank_account' | 'crypto_wallet';
  label: string;
  value: string;
} {
  const method = contact.method.toLowerCase();
  if (method.includes('momo') || method.includes('mobile')) {
    return { kind: 'mobile_money', label: contact.method, value: contact.identifier };
  }
  if (method.includes('trc') || method.includes('erc') || method.includes('solana')) {
    return { kind: 'crypto_wallet', label: contact.method, value: contact.identifier };
  }
  return { kind: 'bank_account', label: contact.method, value: contact.identifier };
}
