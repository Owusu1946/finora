import { UserProfileSchema, type UpdateUserProfile, type UserProfile } from '@finora/shared';

type GetToken = () => Promise<string | null>;

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

async function requestProfile(
  path: string,
  getToken: GetToken,
  init?: RequestInit,
): Promise<UserProfile> {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');

  const token = await getToken();
  if (!token) throw new Error('A Clerk session token is required.');

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) throw new Error(`Profile request failed with status ${response.status}.`);

  const payload: unknown = await response.json();
  const parsed = UserProfileSchema.safeParse(
    typeof payload === 'object' && payload !== null && 'profile' in payload
      ? payload.profile
      : undefined,
  );
  if (!parsed.success) throw new Error('Profile response did not match the expected contract.');
  return parsed.data;
}

async function requestProfileUpdate(getToken: GetToken, updates: UpdateUserProfile) {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');

  const token = await getToken();
  if (!token) throw new Error('A Clerk session token is required.');

  const response = await fetch(`${apiUrl}/v1/auth/me`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) throw new Error(`Profile request failed with status ${response.status}.`);
}

export function getUserProfile(getToken: GetToken) {
  return requestProfile('/v1/auth/me', getToken);
}

export function updateUserProfile(getToken: GetToken, updates: UpdateUserProfile) {
  return requestProfileUpdate(getToken, updates);
}
