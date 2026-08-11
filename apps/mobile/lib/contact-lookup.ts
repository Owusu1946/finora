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

/** Map a saved contact into international send wizard seed fields. */
export function contactToSendSeed(contact: Contact): {
  recipientName: string;
  currency: string;
  destinationValue: string;
  destinationLabel: string;
  destinationKind: 'mobile_money' | 'bank_account' | 'crypto_wallet';
  destinationCountry?: string;
  settlementMethod?:
    | 'MOMO'
    | 'LOCAL_BANK'
    | 'ACH'
    | 'WIRE'
    | 'FPS'
    | 'CHAPS'
    | 'SEPA'
    | 'SWIFT'
    | 'CRYPTO';
  fundingCurrency?: string;
} {
  const dest = contactToPaymentDestination(contact);
  const method = contact.method.toUpperCase();
  let settlementMethod:
    | 'MOMO'
    | 'LOCAL_BANK'
    | 'ACH'
    | 'WIRE'
    | 'FPS'
    | 'CHAPS'
    | 'SEPA'
    | 'SWIFT'
    | 'CRYPTO'
    | undefined;
  let destinationCountry: string | undefined;

  if (dest.kind === 'mobile_money') {
    settlementMethod = 'MOMO';
    destinationCountry = contact.currency === 'KES' ? 'KE' : 'GH';
  } else if (dest.kind === 'crypto_wallet') {
    settlementMethod = 'CRYPTO';
  } else if (method.includes('ACH')) {
    settlementMethod = 'ACH';
    destinationCountry = 'US';
  } else if (method.includes('WIRE')) {
    settlementMethod = 'WIRE';
    destinationCountry = 'US';
  } else if (method.includes('FPS')) {
    settlementMethod = 'FPS';
    destinationCountry = 'GB';
  } else if (method.includes('CHAPS')) {
    settlementMethod = 'CHAPS';
    destinationCountry = 'GB';
  } else if (method.includes('SEPA')) {
    settlementMethod = 'SEPA';
    destinationCountry = 'DE';
  } else if (method.includes('SWIFT')) {
    settlementMethod = 'SWIFT';
    destinationCountry =
      contact.currency === 'GBP' ? 'GB' : contact.currency === 'EUR' ? 'DE' : 'US';
  } else if (contact.currency === 'GHS') {
    settlementMethod = 'LOCAL_BANK';
    destinationCountry = 'GH';
  } else if (contact.currency === 'NGN') {
    settlementMethod = 'LOCAL_BANK';
    destinationCountry = 'NG';
  }

  return {
    recipientName: contact.name,
    currency: contact.currency,
    fundingCurrency: contact.currency,
    destinationValue: dest.value,
    destinationLabel: dest.label,
    destinationKind: dest.kind,
    destinationCountry,
    settlementMethod,
  };
}
