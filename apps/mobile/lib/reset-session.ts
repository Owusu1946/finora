import AsyncStorage from '@react-native-async-storage/async-storage';

import { setAccountType } from '@/lib/account';
import { clearApprovals } from '@/lib/approvals-storage';
import { clearContacts } from '@/lib/contacts-storage';
import { clearIntegrations } from '@/lib/integrations-storage';
import { clearInvoices } from '@/lib/invoices-storage';
import { clearPasscode } from '@/lib/passcode-storage';
import { clearRecurring } from '@/lib/recurring-storage';
import { clearTransactions } from '@/lib/transactions-storage';

const KEYS = [
  'finora.auth.session',
  'finora.onboarding.completed',
  'finora.accountType',
  'finora.passcode.hash',
  'finora.contacts.v2',
  'finora.approvals.v1',
  'finora.transactions.v1',
  'finora.invoices.v1',
  'finora.recurring.v1',
  'finora.integrations.v1',
] as const;

/** Clears auth + onboarding + passcode + business demo persistence. */
export async function resetFinoraSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...KEYS]);
  } catch {
    // Native module may be unavailable; in-memory maps in storage helpers won't clear
    // across modules, but next boot with working AsyncStorage will read empty.
  }
  await clearPasscode();
  await clearContacts();
  await clearApprovals();
  await clearTransactions();
  await clearInvoices();
  await clearRecurring();
  await clearIntegrations();
  setAccountType('personal');
}
