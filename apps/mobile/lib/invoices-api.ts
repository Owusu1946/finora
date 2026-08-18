import {
  InvoiceListResponseSchema,
  InvoicePreferencesSchema,
  type InvoiceDateRange,
} from '@finora/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;
const CACHE_KEY = 'finora.remote-invoices.v1';

async function request(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  const token = await getToken();
  if (!apiUrl || !token) throw new Error('Invoice API is not ready.');
  const response = await fetch(`${apiUrl}/v1/invoices${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error('Invoice request failed.');
  return payload;
}

export async function getRemoteInvoices(getToken: GetToken) {
  const result = InvoiceListResponseSchema.parse(await request('', getToken));
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result)).catch(() => undefined);
  return result;
}

export async function getCachedRemoteInvoices() {
  const raw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
  if (!raw) return null;
  return InvoiceListResponseSchema.safeParse(JSON.parse(raw)).data ?? null;
}

export async function updateRemoteInvoicePreferences(getToken: GetToken, range: InvoiceDateRange) {
  return InvoicePreferencesSchema.parse(
    await request('/preferences', getToken, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(range),
    }),
  );
}

export async function queueInvoiceSync(getToken: GetToken) {
  await request('/sync', getToken, { method: 'POST' });
}
