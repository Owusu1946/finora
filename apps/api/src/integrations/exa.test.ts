import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExaClient } from './exa';

afterEach(() => vi.unstubAllGlobals());

describe('Exa integration', () => {
  it('uses token-efficient highlights and strips explicit slash commands', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        query: 'current Ghana policy rate',
        type: 'fast',
        contents: { highlights: true },
      });
      return Response.json({
        requestId: 'request-1',
        results: [
          {
            title: 'Bank of Ghana',
            url: 'https://www.bog.gov.gh/',
            highlights: ['Policy rate information'],
          },
        ],
      });
    });
    vi.stubGlobal('fetch', request);

    const result = await createExaClient('test-key').search({
      query: '/web current Ghana policy rate',
      limit: 5,
    });

    expect(result.sources).toEqual([
      expect.objectContaining({ domain: 'bog.gov.gh', excerpt: 'Policy rate information' }),
    ]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the server secret is missing', async () => {
    await expect(
      createExaClient().search({ query: 'current policy rate', limit: 5 }),
    ).rejects.toThrow('web_search_not_configured');
  });
});
