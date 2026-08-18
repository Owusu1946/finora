import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGoogleAuthorizationUrl, GMAIL_SCOPES, searchGmailMessages } from './google-gmail';

afterEach(() => vi.unstubAllGlobals());

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

describe('searchGmailMessages', () => {
  it('calls Gmail with invoice filters and returns message summaries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ messages: [{ id: 'invoice-message-1' }], resultSizeEstimate: 1 }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'invoice-message-1',
            threadId: 'thread-1',
            internalDate: '1760000000000',
            snippet: 'Amount due: GHS 1,250.50',
            payload: {
              headers: [
                { name: 'From', value: 'billing@example.com' },
                { name: 'To', value: 'me@example.com' },
                { name: 'Subject', value: 'Invoice INV-2048' },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchGmailMessages('access-token', { invoiceOnly: true, limit: 1 });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({
      id: 'invoice-message-1',
      subject: 'Invoice INV-2048',
      from: 'billing@example.com',
    });
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('invoice');
  });
});
