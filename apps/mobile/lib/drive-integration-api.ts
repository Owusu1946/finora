import { DriveConnectResponseSchema, DriveIntegrationStatusSchema, DriveSearchResponseSchema, type DriveIntegrationStatus } from '@finora/shared';
import { getApiUrl } from './api-url';

type GetToken = () => Promise<string | null>;
async function driveRequest(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl(); if (!apiUrl) throw new Error('The Finora API is not configured.');
  const token = await getToken(); if (!token) throw new Error('Your session is not ready. Try again.');
  const response = await fetch(`${apiUrl}/v1/integrations/drive${path}`, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...init?.headers } });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Could not connect Google Drive.');
  return payload;
}
export async function getDriveIntegrationStatus(getToken: GetToken): Promise<DriveIntegrationStatus> { return DriveIntegrationStatusSchema.parse(await driveRequest('/status', getToken)); }
export async function beginDriveConnection(getToken: GetToken, returnUrl: string) { return DriveConnectResponseSchema.parse(await driveRequest('/connect', getToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnUrl }) })); }
export async function disconnectDriveIntegration(getToken: GetToken) { return DriveIntegrationStatusSchema.parse(await driveRequest('/disconnect', getToken, { method: 'POST' })); }
export async function searchDriveFiles(getToken: GetToken, query: string) { return DriveSearchResponseSchema.parse(await driveRequest(`/search?query=${encodeURIComponent(query)}`, getToken)); }
