import { extractText, getDocumentProxy } from 'unpdf';

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

async function googleText(url: string, accessToken: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`google_drive_request_failed_${response.status}`);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > 1_000_000) throw new Error('drive_file_too_large');
    const text = await response.text();
    if (text.length > 1_000_000) throw new Error('drive_file_too_large');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function googleBytes(url: string, accessToken: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`google_drive_request_failed_${response.status}`);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > 10_000_000) throw new Error('drive_file_too_large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 10_000_000) throw new Error('drive_file_too_large');
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

export function createDriveAuthorizationUrl(input: {
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
    scope: DRIVE_SCOPES.join(' '),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeDriveCode(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}) {
  return googleRequest<DriveTokenResponse>(GOOGLE_TOKEN_URL, {
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

export async function refreshDriveAccessToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const result = await googleRequest<DriveTokenResponse>(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!result.access_token) throw new Error('google_drive_access_token_missing');
  return { ...result, access_token: result.access_token } as DriveTokenResponse & {
    access_token: string;
  };
}

export async function getDriveIdentity(accessToken: string) {
  return googleRequest<{ sub: string; email?: string }>(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function searchDriveFiles(accessToken: string, query: string, pageToken?: string) {
  const params = new URLSearchParams({
    q: `trashed = false and fullText contains '${query.replaceAll("'", "\\'")}'`,
    pageSize: '20',
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,description)',
  });
  if (pageToken) params.set('pageToken', pageToken);
  return googleRequest<{ files?: DriveFile[]; nextPageToken?: string }>(
    `${DRIVE_FILES_URL}?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export async function getDriveFileMetadata(accessToken: string, fileId: string) {
  return googleRequest<DriveFile>(
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,webViewLink,description`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export async function getDriveFileContent(accessToken: string, file: DriveFile) {
  const isPresentation = file.mimeType === 'application/vnd.google-apps.presentation';
  if (file.mimeType === 'application/pdf' || isPresentation) {
    const bytes = await googleBytes(
      isPresentation
        ? `${DRIVE_FILES_URL}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent('application/pdf')}`
        : `${DRIVE_FILES_URL}/${encodeURIComponent(file.id)}?alt=media`,
      accessToken,
    );
    const pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf);
    const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    const text = pages.join('\n\n').slice(0, 100_000);
    return {
      text,
      citations: pages.reduce<Array<{ quote: string; location: string }>>((result, page, index) => {
        if (page.trim() && result.length < 500)
          result.push({ quote: page.slice(0, 500), location: `Page ${index + 1}` });
        return result;
      }, []),
    };
  }
  const exportMime =
    file.mimeType === 'application/vnd.google-apps.document'
      ? 'text/plain'
      : file.mimeType === 'application/vnd.google-apps.spreadsheet'
        ? 'text/csv'
        : null;
  const url = exportMime
    ? `${DRIVE_FILES_URL}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `${DRIVE_FILES_URL}/${encodeURIComponent(file.id)}?alt=media`;
  if (
    !exportMime &&
    !['text/plain', 'text/csv', 'text/markdown', 'application/json'].includes(file.mimeType)
  ) {
    throw new Error('drive_file_format_not_supported');
  }
  const text = await googleText(url, accessToken);
  const lines = text.slice(0, 100_000).split(/\r?\n/);
  return {
    text: text.slice(0, 100_000),
    citations: lines.reduce<Array<{ quote: string; location: string }>>((result, line, index) => {
      if (line.trim() && result.length < 500)
        result.push({ quote: line.slice(0, 500), location: `Lines ${index + 1}-${index + 1}` });
      return result;
    }, []),
  };
}
