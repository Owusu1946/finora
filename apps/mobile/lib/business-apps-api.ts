import {
  BrowseBusinessAppsResponseSchema,
  BusinessAppListResponseSchema,
  ConnectBusinessAppResponseSchema,
} from '@finora/shared';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;

export class BusinessAppsError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'BusinessAppsError';
  }
}

async function appsRequest(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new BusinessAppsError('The Finora API is not configured.', null);
  const token = await getToken();
  if (!token) throw new BusinessAppsError('Your session is not ready. Try again.', null);
  const response = await fetch(`${apiUrl}/v1/apps${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;
  if (!response.ok) {
    throw new BusinessAppsError(
      payload?.message ?? 'Could not reach your apps. Try again.',
      payload?.error ?? null,
    );
  }
  return payload;
}

/** The curated business apps with this user's connection status. */
export async function listBusinessApps(getToken: GetToken) {
  return BusinessAppListResponseSchema.parse(await appsRequest('', getToken)).apps;
}

/** One page of every app Composio offers, optionally filtered by a search. */
export async function browseBusinessApps(
  getToken: GetToken,
  input: { search?: string; cursor?: string | null },
) {
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set('search', input.search.trim());
  if (input.cursor) params.set('cursor', input.cursor);
  const query = params.toString();
  return BrowseBusinessAppsResponseSchema.parse(
    await appsRequest(`/browse${query ? `?${query}` : ''}`, getToken),
  );
}

/**
 * Opens the app's hosted sign-in (or key form) and waits for the user to come
 * back. Resolves false when they close it; callers refresh status either way.
 */
export async function connectBusinessApp(getToken: GetToken, slug: string) {
  const returnUrl = Linking.createURL('/integrations');
  const { url } = ConnectBusinessAppResponseSchema.parse(
    await appsRequest(`/${encodeURIComponent(slug)}/connect`, getToken, {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    }),
  );
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  if (result.type !== 'success') return false;
  const status = new URL(result.url).searchParams.get('status');
  if (status && status !== 'success') {
    throw new BusinessAppsError("The app didn't finish connecting. Try again.", 'connect_failed');
  }
  return true;
}

export async function disconnectBusinessApp(getToken: GetToken, slug: string) {
  await appsRequest(`/${encodeURIComponent(slug)}`, getToken, { method: 'DELETE' });
}

/** Sends a WhatsApp message the user reviewed and approved in chat. */
export async function sendWhatsAppMessage(getToken: GetToken, input: { to: string; text: string }) {
  await appsRequest('/whatsapp/messages', getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
