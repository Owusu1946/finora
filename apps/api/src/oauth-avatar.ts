import type { ClerkClient, User } from '@clerk/backend';

/**
 * OAuth providers whose current avatar we can pull with the stored access
 * token, without any user interaction. Clerk only re-syncs external profile
 * data on sign-in (and periodic token refresh), so a long-lived mobile
 * session otherwise shows the avatar from signup forever.
 */
const PROVIDER_PICTURE_ENDPOINTS = {
  google: 'https://openidconnect.googleapis.com/v1/userinfo',
  facebook: 'https://graph.facebook.com/me/picture?redirect=false&type=large',
} satisfies Record<string, string>;

type OAuthEndpointProvider = keyof typeof PROVIDER_PICTURE_ENDPOINTS;

type GoogleUserInfo = { picture?: unknown };
type FacebookPicture = { data?: { url?: unknown } };

async function resolveProviderPicture(
  provider: OAuthEndpointProvider,
  accessToken: string,
): Promise<string | null> {
  const response = await fetch(PROVIDER_PICTURE_ENDPOINTS[provider], {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  if (provider === 'google') {
    const picture = (payload as GoogleUserInfo | null)?.picture;
    return typeof picture === 'string' && picture ? picture : null;
  }
  const url = (payload as FacebookPicture | null)?.data?.url;
  return typeof url === 'string' && url ? url : null;
}

/**
 * Best-effort: pull the provider's current avatar, and when it differs from
 * what Clerk last saw, push it onto the Clerk profile so every surface
 * (mobile, MCP-visible profiles, our user_profiles rows) reads fresh.
 * Returns the passed user unless an image was updated, in which case the
 * freshly re-fetched Clerk user is returned.
 */
export async function syncOAuthAvatar(clerk: ClerkClient, user: User): Promise<User> {
  if (!user.id || !user.externalAccounts) return user;

  try {
    for (const provider of Object.keys(PROVIDER_PICTURE_ENDPOINTS) as OAuthEndpointProvider[]) {
      const account = user.externalAccounts.find((item) => item.provider === provider);
      if (!account) continue;

      const accessTokens = await clerk.users.getUserOauthAccessToken(user.id, provider);
      const token = accessTokens.data[0]?.token;
      if (!token) continue;

      const pictureUrl = await resolveProviderPicture(provider, token);
      if (!pictureUrl) continue;
      // Equality against both snapshots means the provider avatar matches
      // what Clerk already imported, and nothing needs to move.
      if (pictureUrl === account.imageUrl || pictureUrl === user.imageUrl) continue;

      const download = await fetch(pictureUrl);
      if (!download.ok) continue;
      const bytes = await download.arrayBuffer();
      if (!bytes.byteLength) continue;

      const contentType = download.headers.get('content-type') ?? 'image/jpeg';
      await clerk.users.updateUserProfileImage(user.id, {
        file: new Blob([bytes], { type: contentType }),
      });
      return (await clerk.users.getUser(user.id)) ?? user;
    }
  } catch (error) {
    // Expired/revoked provider tokens or transient Graph/API failures must
    // never block the profile read.
    console.warn('[oauth-avatar] sync skipped:', error instanceof Error ? error.message : error);
  }
  return user;
}
