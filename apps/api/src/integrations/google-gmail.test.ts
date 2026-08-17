import { describe, expect, it } from 'vitest';

import { createGoogleAuthorizationUrl, GMAIL_SCOPES } from './google-gmail';

describe('createGoogleAuthorizationUrl', () => {
  it('uses PKCE, offline access, state, and the bounded Gmail scope', () => {
    const url = new URL(
      createGoogleAuthorizationUrl({
        clientId: 'client-id',
        redirectUri: 'https://api.example.com/oauth/google/callback',
        state: 'one-time-state',
        codeChallenge: 'pkce-challenge',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe('one-time-state');
    expect(url.searchParams.get('code_challenge')).toBe('pkce-challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([...GMAIL_SCOPES]);
  });
});
