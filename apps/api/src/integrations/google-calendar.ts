const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const CALENDAR_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

type GoogleTokenResponse = { access_token?: string; refresh_token?: string; scope?: string };

function providerError(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null;
  const error = payload.error;
  return typeof error === 'string' ? error : null;
}

async function googleRequest<T>(url: string, init: RequestInit, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
    if (!response.ok)
      throw new Error(
        `google_calendar_request_failed_${response.status}${providerError(payload) ? `_${providerError(payload)}` : ''}`,
      );
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function createCalendarAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    scope: CALENDAR_SCOPES.join(' '),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCalendarCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}) {
  return googleRequest<GoogleTokenResponse>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: input.codeVerifier,
    }),
  });
}

export async function refreshCalendarAccessToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const result = await googleRequest<GoogleTokenResponse>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!result.access_token) throw new Error('google_access_token_missing');
  return { ...result, access_token: result.access_token } as GoogleTokenResponse & {
    access_token: string;
  };
}

export async function listGoogleCalendars(accessToken: string) {
  return googleRequest<{ items?: Array<{ id: string; summary?: string; primary?: boolean }> }>(
    GOOGLE_CALENDAR_LIST_URL,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  etag?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function listGoogleCalendarEvents(
  accessToken: string,
  input: { syncToken?: string; pageToken?: string } = {},
) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    showDeleted: 'true',
    maxResults: '100',
  });
  if (input.pageToken) params.set('pageToken', input.pageToken);
  if (input.syncToken) params.set('syncToken', input.syncToken);
  else {
    params.set('orderBy', 'startTime');
    params.set('timeMin', new Date().toISOString());
    params.set('timeMax', new Date(Date.now() + 180 * 86_400_000).toISOString());
  }
  return googleRequest<{
    items?: GoogleCalendarEvent[];
    nextPageToken?: string;
    nextSyncToken?: string;
  }>(`${GOOGLE_EVENTS_URL}/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function revokeGoogleCalendarToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).catch(() => undefined);
}
