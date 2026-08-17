const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const GMAIL_MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

export const GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
] as const;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function googleErrorCode(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return null;
  const error = payload.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'string') {
    return error.status.toLowerCase();
  }
  return null;
}

async function googleRequest<T>(url: string, init: RequestInit, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
    if (!response.ok) {
      const providerCode = googleErrorCode(payload);
      throw new Error(
        `google_request_failed_${response.status}${providerCode ? `_${providerCode}` : ''}`,
      );
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function createGoogleAuthorizationUrl(input: {
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
    scope: GMAIL_SCOPES.join(' '),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(input: {
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

export async function refreshGoogleAccessToken(input: {
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
  return result;
}

export async function getGoogleIdentity(accessToken: string) {
  const identity = await googleRequest<{ sub?: string; email?: string }>(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!identity.sub || !identity.email) throw new Error('google_identity_missing');
  return { subject: identity.sub, email: identity.email };
}

export async function getGmailProfile(accessToken: string) {
  return googleRequest<{ emailAddress?: string; historyId?: string }>(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function listGmailInvoiceCandidates(accessToken: string) {
  const query = encodeURIComponent('newer_than:90d {invoice receipt bill "amount due"}');
  const list = await googleRequest<{
    messages?: Array<{ id: string }>;
    resultSizeEstimate?: number;
  }>(`${GMAIL_MESSAGES_URL}?q=${query}&maxResults=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return {
    messageIds: (list.messages ?? []).map((message) => message.id),
    estimate: list.resultSizeEstimate ?? 0,
  };
}

export async function revokeGoogleToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).catch(() => undefined);
}
