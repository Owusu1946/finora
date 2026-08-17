import {
  GmailConnectResponseSchema,
  GmailIntegrationStatusSchema,
  GmailSyncResponseSchema,
  type GmailIntegrationStatus,
} from '@finora/shared';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;

function describeError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'UnknownError', message: String(error) };
}

function payloadSummary(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { type: typeof payload };
  return { type: 'object', keys: Object.keys(payload).slice(0, 10) };
}

async function gmailRequest(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('The Finora API is not configured.');
  const method = init?.method ?? 'GET';
  const requestUrl = `${apiUrl}/v1/integrations/gmail${path}`;
  const startedAt = Date.now();
  const requestId = Math.random().toString(36).slice(2, 10);
  console.info('[GmailIntegration] request starting', {
    requestId,
    method,
    path,
    apiOrigin: new URL(apiUrl).origin,
  });

  let token: string | null;
  try {
    token = await getToken();
    console.info('[GmailIntegration] Clerk token resolved', {
      requestId,
      available: Boolean(token),
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('[GmailIntegration] Clerk token failed', {
      requestId,
      elapsedMs: Date.now() - startedAt,
      ...describeError(error),
    });
    throw error;
  }
  if (!token) throw new Error('Your session is not ready. Try again.');
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.error('[GmailIntegration] request timed out', {
      requestId,
      method,
      path,
      timeoutMs: 30_000,
    });
    controller.abort();
  }, 30_000);
  try {
    const response = await fetch(requestUrl, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
    console.info('[GmailIntegration] response received', {
      requestId,
      method,
      path,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      elapsedMs: Date.now() - startedAt,
    });
    const responseText = await response.text();
    let payload: unknown = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      console.error('[GmailIntegration] response JSON parsing failed', {
        requestId,
        bodyCharacters: responseText.length,
        ...describeError(error),
      });
      throw new Error('Finora returned an invalid Gmail response.');
    }
    console.info('[GmailIntegration] response parsed', {
      requestId,
      bodyCharacters: responseText.length,
      ...payloadSummary(payload),
    });
    if (!response.ok) {
      const code =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String(payload.error)
          : `status_${response.status}`;
      console.error('[GmailIntegration] API rejected request', {
        requestId,
        method,
        path,
        status: response.status,
        code,
      });
      throw new Error(
        code === 'gmail_not_configured'
          ? 'Gmail is not configured yet.'
          : 'Could not connect Gmail. Try again.',
      );
    }
    return payload;
  } catch (error) {
    console.error('[GmailIntegration] request failed', {
      requestId,
      method,
      path,
      elapsedMs: Date.now() - startedAt,
      aborted: controller.signal.aborted,
      ...describeError(error),
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getGmailIntegrationStatus(
  getToken: GetToken,
): Promise<GmailIntegrationStatus> {
  return GmailIntegrationStatusSchema.parse(await gmailRequest('/status', getToken));
}

export async function beginGmailConnection(getToken: GetToken, returnUrl: string) {
  return GmailConnectResponseSchema.parse(
    await gmailRequest('/connect', getToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl }),
    }),
  );
}

export async function disconnectGmailIntegration(getToken: GetToken) {
  return GmailIntegrationStatusSchema.parse(
    await gmailRequest('/disconnect', getToken, { method: 'POST' }),
  );
}

export async function syncGmailIntegration(getToken: GetToken) {
  return GmailSyncResponseSchema.parse(await gmailRequest('/sync', getToken, { method: 'POST' }));
}
