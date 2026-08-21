import {
  MemoryListResponseSchema,
  type CreateMemoryInput,
  type FinoraMemory,
  type MemoryKind,
} from '@finora/shared';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;

async function request(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('The Finora API is not configured.');
  const token = await getToken();
  if (!token) throw new Error('Your session is not ready. Try again.');
  const response = await fetch(`${apiUrl}/v1/memories${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : 'Memory request failed.',
    );
  }
  return payload;
}

export async function getMemories(getToken: GetToken) {
  return MemoryListResponseSchema.parse(await request('', getToken));
}

export async function setMemoriesEnabled(getToken: GetToken, enabled: boolean) {
  const payload = await request('/settings', getToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return Boolean((payload as { enabled?: unknown }).enabled);
}

export async function createMemory(getToken: GetToken, input: CreateMemoryInput) {
  const payload = (await request('', getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })) as { memory: FinoraMemory };
  return payload.memory;
}

export async function updateMemory(
  getToken: GetToken,
  id: string,
  patch: Partial<Pick<FinoraMemory, 'kind' | 'title' | 'content'>>,
) {
  const payload = (await request(`/${encodeURIComponent(id)}`, getToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })) as { memory: FinoraMemory };
  return payload.memory;
}

export async function forgetMemory(getToken: GetToken, id: string) {
  await request(`/${encodeURIComponent(id)}`, getToken, { method: 'DELETE' });
}

export async function clearMemories(getToken: GetToken) {
  await request('', getToken, { method: 'DELETE' });
}

export type { FinoraMemory, MemoryKind };
