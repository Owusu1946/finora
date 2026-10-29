import { listBeneficiaries } from '@/lib/beneficiaries-storage';
import { listContacts } from '@/lib/contacts-storage';
import { listEmployees } from '@/lib/employees-storage';
import { listRecentFinoraTags } from '@/lib/finora-tags';
import { listSuppliers } from '@/lib/suppliers-storage';

/** Deepgram keyterm prompting works best with a focused list. */
const MAX_KEYTERMS = 50;
const MAX_KEYTERM_LENGTH = 40;

/** Money words a speech model tends to mangle in Finora's markets. */
const FINANCE_KEYTERMS = [
  'Finora',
  'cedis',
  'GHS',
  'USD',
  'EUR',
  'GBP',
  'NGN',
  'MoMo',
  'MTN MoMo',
  'Telecel Cash',
  'AirtelTigo Money',
  'payroll',
  'invoice',
  'payout',
];

/**
 * Names and tags from the user's own Finora data (contacts, beneficiaries,
 * suppliers, employees, recent tags) followed by common money words, so
 * dictation spells "send 500 cedis to Kwame" correctly. Personal terms come
 * first because they are the hardest to recognise and matter most.
 */
export async function loadVoiceKeyterms() {
  const [contacts, beneficiaries, suppliers, employees, tags] = await Promise.all([
    listContacts().catch(() => []),
    listBeneficiaries().catch(() => []),
    listSuppliers().catch(() => []),
    listEmployees().catch(() => []),
    listRecentFinoraTags().catch(() => []),
  ]);

  const personal = [
    ...contacts.map((item) => item.name),
    ...beneficiaries.map((item) => item.name),
    ...suppliers.map((item) => item.name),
    ...employees.map((item) => item.name),
    ...tags.flatMap((item) => [item.displayName, item.tag]),
  ];

  const seen = new Set<string>();
  const keyterms: string[] = [];
  for (const raw of [...personal, ...FINANCE_KEYTERMS]) {
    const term = raw?.trim();
    if (!term || term.length > MAX_KEYTERM_LENGTH) continue;
    const id = term.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    keyterms.push(term);
    if (keyterms.length >= MAX_KEYTERMS) break;
  }
  return keyterms;
}
