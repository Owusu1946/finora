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

  it('searches and verifies product listings against a stated budget', async () => {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (url.endsWith('/search')) {
        expect(body.query).toContain('budget up to USD 500');
        return Response.json({
          requestId: 'product-request',
          results: [{ title: 'iPhone 17 Pro Max refurbished - $479', url: 'https://shop.example/iphone', highlights: ['$479 refurbished'] }],
        });
      }
      expect(url.endsWith('/contents')).toBe(true);
      return Response.json({
        results: [{ title: 'iPhone 17 Pro Max refurbished', url: 'https://shop.example/iphone', text: 'Refurbished iPhone 17 Pro Max. Price: $479. In stock. Free shipping.' }],
        statuses: [{ id: 'https://shop.example/iphone', status: 'success' }],
      });
    });
    vi.stubGlobal('fetch', request);

    const result = await createExaClient('test-key').products({
      query: 'find an iPhone 17 Pro Max',
      budget: 500,
      currency: 'usd',
    });

    expect(result.products[0]).toEqual(expect.objectContaining({
      price: '$479',
      priceAmount: 479,
      verified: true,
      condition: 'refurbished',
      availability: 'listed',
      withinBudget: true,
    }));
    expect(request).toHaveBeenCalledTimes(2);
  });
});
