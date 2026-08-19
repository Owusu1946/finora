const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';

export const DRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export type DriveTokenResponse = { access_token?: string; refresh_token?: string; scope?: string };
export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  description?: string;
};

async function googleRequest<T>(url: string, init: RequestInit, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
    if (!response.ok) throw new Error(`google_drive_request_failed_${response.status}`);
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function createDriveAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge: string }) {
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
    scope: DRIVE_SCOPES.join(' '),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeDriveCode(input: { clientId: string; clientSecret: string; redirectUri: string; code: string; codeVerifier: string }) {
  return googleRequest<DriveTokenResponse>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: input.code, client_id: input.clientId, client_secret: input.clientSecret, redirect_uri: input.redirectUri, grant_type: 'authorization_code', code_verifier: input.codeVerifier }),
  });
}

export async function refreshDriveAccessToken(input: { clientId: string; clientSecret: string; refreshToken: string }) {
  const result = await googleRequest<DriveTokenResponse>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret, refresh_token: input.refreshToken, grant_type: 'refresh_token' }),
  });
  if (!result.access_token) throw new Error('google_drive_access_token_missing');
  return { ...result, access_token: result.access_token } as DriveTokenResponse & { access_token: string };
}

export async function getDriveIdentity(accessToken: string) {
  return googleRequest<{ sub: string; email?: string }>(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function searchDriveFiles(accessToken: string, query: string, pageToken?: string) {
  const params = new URLSearchParams({ q: `trashed = false and fullText contains '${query.replaceAll("'", "\\'")}'`, pageSize: '20', fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,description)' });
  if (pageToken) params.set('pageToken', pageToken);
  return googleRequest<{ files?: DriveFile[]; nextPageToken?: string }>(`${DRIVE_FILES_URL}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function getDriveFileMetadata(accessToken: string, fileId: string) {
  return googleRequest<DriveFile>(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,webViewLink,description`, { headers: { Authorization: `Bearer ${accessToken}` } });
}
