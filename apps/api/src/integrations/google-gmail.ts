const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const GMAIL_MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

export type GmailSearchInput = {
  keywords?: string;
  from?: string;
  startDate?: string;
  endDate?: string;
  hasAttachment?: boolean;
  invoiceOnly?: boolean;
  limit?: number;
  cursor?: string;
};

export type GmailMessageSummary = {
  id: string;
  threadId: string | null;
  from: string;
  to: string;
  subject: string;
  receivedAt: string | null;
  snippet: string;
  hasAttachment: boolean;
};

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
  return { ...result, access_token: result.access_token } as GoogleTokenResponse & {
    access_token: string;
  };
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

export async function listGmailInvoiceCandidates(
  accessToken: string,
  range?: { startDate: string; endDate: string },
  pageToken?: string,
) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 89);
  const selectedRange = range ?? {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
  const before = new Date(`${selectedRange.endDate}T00:00:00.000Z`);
  before.setUTCDate(before.getUTCDate() + 1);
  const after = new Date(`${selectedRange.startDate}T00:00:00.000Z`);
  after.setUTCDate(after.getUTCDate() - 1);
  const query = encodeURIComponent(
    `after:${after.toISOString().slice(0, 10).replaceAll('-', '/')} before:${before.toISOString().slice(0, 10).replaceAll('-', '/')} {invoice receipt bill "amount due"}`,
  );
  const list = await googleRequest<{
    messages?: Array<{ id: string }>;
    resultSizeEstimate?: number;
    nextPageToken?: string;
  }>(
    `${GMAIL_MESSAGES_URL}?q=${query}&maxResults=20${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const messages: Array<{
    id: string;
    threadId?: string;
    internalDate?: string;
    snippet?: string;
    payload?: { headers?: Array<{ name: string; value: string }> };
  }> = [];
  for (let index = 0; index < (list.messages ?? []).length; index += 5) {
    const batch = await Promise.allSettled(
      (list.messages ?? []).slice(index, index + 5).map((message) =>
        googleRequest<{
          id: string;
          threadId?: string;
          internalDate?: string;
          snippet?: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        }>(
          `${GMAIL_MESSAGES_URL}/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      ),
    );
    for (const result of batch) if (result.status === 'fulfilled') messages.push(result.value);
  }
  return {
    messages,
    estimate: list.resultSizeEstimate ?? messages.length,
    nextPageToken: list.nextPageToken,
  };
}

function gmailDate(value: string | undefined, fallback: string) {
  return value ? value.replaceAll('-', '/') : fallback;
}

function meaningfulFilter(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== '*' ? trimmed : undefined;
}

function meaningfulPageToken(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && !['start', 'first', 'initial'].includes(trimmed.toLowerCase())
    ? trimmed
    : undefined;
}

function buildGmailQuery(input: GmailSearchInput) {
  const clauses = [
    meaningfulFilter(input.keywords),
    meaningfulFilter(input.from) ? `from:(${meaningfulFilter(input.from)})` : undefined,
    input.startDate ? `after:${gmailDate(input.startDate, '')}` : undefined,
    input.endDate ? `before:${gmailDate(input.endDate, '')}` : undefined,
    input.hasAttachment ? 'has:attachment' : undefined,
    input.invoiceOnly ? '{invoice "amount due" "total due" bill}' : undefined,
  ].filter(Boolean);
  return clauses.join(' ') || 'newer_than:90d';
}

function headerValue(headers: Array<{ name: string; value: string }> | undefined, name: string) {
  return headers?.find((header) => header.name.toLowerCase() === name)?.value ?? '';
}

export async function searchGmailMessages(accessToken: string, input: GmailSearchInput) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 20);
  const query = encodeURIComponent(buildGmailQuery(input));
  const pageToken = meaningfulPageToken(input.cursor);
  const list = await googleRequest<{
    messages?: Array<{ id: string }>;
    resultSizeEstimate?: number;
    nextPageToken?: string;
  }>(
    `${GMAIL_MESSAGES_URL}?q=${query}&maxResults=${limit}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const summaries: GmailMessageSummary[] = [];
  for (let index = 0; index < (list.messages ?? []).length; index += 5) {
    const batch = await Promise.allSettled(
      (list.messages ?? []).slice(index, index + 5).map((message) =>
        googleRequest<{
          id: string;
          threadId?: string;
          internalDate?: string;
          snippet?: string;
          payload?: { headers?: Array<{ name: string; value: string }>; parts?: unknown[] };
        }>(
          `${GMAIL_MESSAGES_URL}/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      ),
    );
    for (const result of batch) {
      if (result.status !== 'fulfilled') continue;
      const value = result.value;
      const headers = value.payload?.headers;
      summaries.push({
        id: value.id,
        threadId: value.threadId ?? null,
        from: headerValue(headers, 'from'),
        to: headerValue(headers, 'to'),
        subject: headerValue(headers, 'subject'),
        receivedAt: value.internalDate ? new Date(Number(value.internalDate)).toISOString() : null,
        snippet: (value.snippet ?? '').slice(0, 500),
        hasAttachment:
          input.hasAttachment === true ||
          (Array.isArray(value.payload?.parts) && value.payload.parts.length > 0),
      });
    }
  }
  return {
    messages: summaries,
    nextCursor: list.nextPageToken ?? null,
    estimatedTotal: list.resultSizeEstimate ?? summaries.length,
  };
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

type GmailPayload = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayload[];
};

function plainTextFromPayload(payload: GmailPayload) {
  const texts: string[] = [];
  const visit = (part: typeof payload) => {
    if (part.mimeType === 'text/plain' && part.body?.data)
      texts.push(decodeBase64Url(part.body.data));
    for (const child of part.parts ?? []) visit(child);
  };
  visit(payload);
  return texts
    .join('\n')
    .replaceAll(/\r?\n{3,}/g, '\n\n')
    .slice(0, 20_000);
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const message = await googleRequest<{
    id: string;
    threadId?: string;
    internalDate?: string;
    snippet?: string;
    payload?: GmailPayload & { headers?: Array<{ name: string; value: string }> };
  }>(`${GMAIL_MESSAGES_URL}/${encodeURIComponent(messageId)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const headers = message.payload?.headers;
  return {
    id: message.id,
    threadId: message.threadId ?? null,
    from: headerValue(headers, 'from'),
    to: headerValue(headers, 'to'),
    subject: headerValue(headers, 'subject'),
    receivedAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    snippet: (message.snippet ?? '').slice(0, 500),
    text: plainTextFromPayload(message.payload ?? {}),
    attachments: (message.payload?.parts ?? [])
      .filter((part) => Boolean(part.filename))
      .slice(0, 20)
      .map((part) => ({
        filename: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        size: part.body?.size ?? 0,
      })),
  };
}

export async function revokeGoogleToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).catch(() => undefined);
}
