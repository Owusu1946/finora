import AsyncStorage from '@react-native-async-storage/async-storage';

import { setAccountType } from '@/lib/account';
import { clearApprovals } from '@/lib/approvals-storage';
import { clearContacts } from '@/lib/contacts-storage';
import { clearRecentFinoraTags } from '@/lib/finora-tags';
import { clearCalendarEvents } from '@/lib/calendar-events-storage';
import { clearIntegrations } from '@/lib/integrations-storage';
import { clearInvoices } from '@/lib/invoices-storage';
import { clearMemoryStore } from '@/lib/memory-storage';
import { clearPasscode } from '@/lib/passcode-storage';
import { clearRecurring } from '@/lib/recurring-storage';
import { clearSettings } from '@/lib/settings-storage';
import { clearSmsRequests } from '@/lib/sms-requests-storage';
import { clearTransactions } from '@/lib/transactions-storage';

const KEYS = [
  'finora.auth.session',
  'finora.onboarding.completed',
  'finora.accountType',
  'finora.passcode.hash',
  'finora.contacts.v2',
  'finora.approvals.v2',
  'finora.transactions.v1',
  'finora.invoices.v1',
  'finora.calendar-events.v1',
  'finora.sms-requests.v1',
  'finora.recurring.v1',
  'finora.integrations.v1',
  'finora.settings.v1',
  'finora.memories.v1',
  'finora.finora-tags.recent.v1',
] as const;

/** Clears auth + onboarding + passcode + local demo persistence. */
export async function resetFinoraSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...KEYS]);
  } catch {
    // Native module may be unavailable; in-memory maps in storage helpers won't clear
    // across modules, but next boot with working AsyncStorage will read empty.
  }
  await clearPasscode();
  await clearContacts();
  await clearRecentFinoraTags();
  await clearApprovals();
  await clearTransactions();
  await clearInvoices();
  await clearCalendarEvents();
  await clearSmsRequests();
  await clearRecurring();
  await clearIntegrations();
  await clearSettings();
  await clearMemoryStore();
  setAccountType('personal');
}
