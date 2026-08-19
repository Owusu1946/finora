import {
  CalendarConnectResponseSchema,
  CalendarIntegrationStatusSchema,
  CalendarSyncResponseSchema,
  type CalendarIntegrationStatus,
} from '@finora/shared';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;

async function calendarRequest(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('The Finora API is not configured.');
  const token = await getToken();
  if (!token) throw new Error('Your session is not ready. Try again.');
  const response = await fetch(`${apiUrl}/v1/integrations/calendar${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...init?.headers },
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok)
    throw new Error(
      payload?.error === 'calendar_not_configured'
        ? 'Google Calendar is not configured yet.'
        : (payload?.error ?? 'Could not connect Google Calendar. Try again.'),
    );
  return payload;
}

export async function getCalendarIntegrationStatus(
  getToken: GetToken,
): Promise<CalendarIntegrationStatus> {
  return CalendarIntegrationStatusSchema.parse(await calendarRequest('/status', getToken));
}
export async function beginCalendarConnection(getToken: GetToken, returnUrl: string) {
  return CalendarConnectResponseSchema.parse(
    await calendarRequest('/connect', getToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl }),
    }),
  );
}
export async function disconnectCalendarIntegration(getToken: GetToken) {
  return CalendarIntegrationStatusSchema.parse(
    await calendarRequest('/disconnect', getToken, { method: 'POST' }),
  );
}
export async function syncCalendarIntegration(getToken: GetToken) {
  return CalendarSyncResponseSchema.parse(
    await calendarRequest('/sync', getToken, { method: 'POST' }),
  );
}
