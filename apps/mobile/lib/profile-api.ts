import { UserProfileSchema, type UpdateUserProfile, type UserProfile } from '@finora/shared';

import { getApiUrl } from '@/lib/api-url';

type GetToken = () => Promise<string | null>;

const PROFILE_REQUEST_TIMEOUT_MS = 30_000;

export class ProfileApiError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'configuration'
      | 'timeout'
      | 'network'
      | 'unauthorized'
      | 'tag_taken'
      | 'server',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

async function profileFetch(path: string, getToken: GetToken, init?: RequestInit) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new ProfileApiError('The Finora API URL is not configured.', 'configuration');

  const token = await getToken();
  if (!token) throw new ProfileApiError('Your session is not ready. Try again.', 'unauthorized');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROFILE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new ProfileApiError('Your session expired. Sign in again.', 'unauthorized', 401);
      }
      if (response.status === 409) {
        throw new ProfileApiError('That Finora tag is already taken.', 'tag_taken', 409);
      }
      throw new ProfileApiError(
        `Profile request failed with status ${response.status}.`,
        'server',
        response.status,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ProfileApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProfileApiError('The local API did not respond in time.', 'timeout');
    }
    throw new ProfileApiError('The mobile app could not reach the local API.', 'network');
  } finally {
    clearTimeout(timeout);
  }
}

async function requestProfile(
  path: string,
  getToken: GetToken,
  init?: RequestInit,
): Promise<UserProfile> {
  const response = await profileFetch(path, getToken, init);
  const payload: unknown = await response.json();
  const parsed = UserProfileSchema.safeParse(
    typeof payload === 'object' && payload !== null && 'profile' in payload
      ? payload.profile
      : undefined,
  );
  if (!parsed.success) throw new Error('Profile response did not match the expected contract.');
  return parsed.data;
}

export function getUserProfile(getToken: GetToken) {
  return requestProfile('/v1/auth/me', getToken);
}

export function updateUserProfile(getToken: GetToken, updates: UpdateUserProfile) {
  return requestProfile('/v1/auth/me', getToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}
