import type {
  AutomationRecord,
  CreateAutomationInput,
  TestAutomationInput,
  UpdateAutomationInput,
} from '@finora/shared';

import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;

export type AutomationActivity = {
  id: string;
  automationId: string;
  automationName: string;
  status:
    | 'evaluated'
    | 'skipped_condition'
    | 'prepared_approval'
    | 'notified'
    | 'failed'
    | 'duplicate';
  summary: string;
  preparationId: string | null;
  approvalId: string | null;
  errorCode: string | null;
  createdAt: string;
};

async function request<T>(path: string, getToken: GetToken, init?: RequestInit): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('Finora API is not configured.');
  const token = await getToken();
  if (!token) throw new Error('Your session is not ready.');
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as T & { message?: string };
  if (!response.ok)
    throw new Error(body?.message ?? `Automation request failed (${response.status}).`);
  return body;
}

export async function listRemoteAutomations(getToken: GetToken) {
  const response = await request<{ automations: AutomationRecord[] }>('/v1/automations', getToken);
  return response.automations;
}

export async function listAutomationActivity(getToken: GetToken, after?: string) {
  const query = after ? `?after=${encodeURIComponent(after)}` : '';
  const response = await request<{ activity: AutomationActivity[] }>(
    `/v1/automations/activity${query}`,
    getToken,
  );
  return response.activity;
}

export async function createRemoteAutomation(getToken: GetToken, input: CreateAutomationInput) {
  const response = await request<{ automation: AutomationRecord }>('/v1/automations', getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.automation;
}

export async function updateRemoteAutomation(getToken: GetToken, input: UpdateAutomationInput) {
  const response = await request<{ automation: AutomationRecord }>(
    `/v1/automations/${input.id}`,
    getToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return response.automation;
}

export async function deleteRemoteAutomation(getToken: GetToken, id: string) {
  await request<unknown>(`/v1/automations/${id}`, getToken, { method: 'DELETE' });
}

export async function testRemoteAutomation(
  getToken: GetToken,
  id: string,
  input: TestAutomationInput,
) {
  return request<{
    matched: boolean;
    triggerMatches: boolean;
    dryRun: true;
    failedConditions: unknown[];
  }>(`/v1/automations/${id}/test`, getToken, { method: 'POST', body: JSON.stringify(input) });
}

export async function runRemoteAutomation(
  getToken: GetToken,
  id: string,
  input: TestAutomationInput,
) {
  return request<{ queued: true; eventId: string }>(`/v1/automations/${id}/run`, getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
