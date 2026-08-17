import {
  GmailConnectResponseSchema,
  GmailIntegrationStatusSchema,
  GmailSyncResponseSchema,
  type GmailIntegrationStatus,
} from '@finora/shared';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;

async function gmailRequest(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('The Finora API is not configured.');
  const token = await getToken();
  if (!token) throw new Error('Your session is not ready. Try again.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${apiUrl}/v1/integrations/gmail${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String(payload.error)
          : `status_${response.status}`;
      throw new Error(
        code === 'gmail_not_configured'
          ? 'Gmail is not configured yet.'
          : 'Could not connect Gmail. Try again.',
      );
    }
    return payload;
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
