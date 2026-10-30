import { describe, expect, it, vi } from 'vitest';

import {
  ComposioError,
  createComposioClient,
  isConnectable,
  isReadOnlyTool,
  type ComposioTool,
} from './composio';

function client(responses: unknown[], status = 200) {
  const fetch = vi.fn(async () => {
    const body = responses.shift();
    return new Response(JSON.stringify(body), { status });
  });
  return { fetch, composio: createComposioClient({ apiKey: 'ak_test', fetch }) };
}

function call(fetch: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetch.mock.calls[index] as [URL, RequestInit];
  return { url: String(url), init, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

describe('createComposioClient', () => {
  it('reuses an enabled auth config', async () => {
    const { fetch, composio } = client([{ items: [{ id: 'ac_1', status: 'ENABLED' }] }]);

    await expect(
      composio.ensureAuthConfig({ slug: 'paystack', name: 'Paystack', auth_schemes: ['API_KEY'] }),
    ).resolves.toBe('ac_1');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(call(fetch).init.headers).toMatchObject({ 'x-api-key': 'ak_test' });
  });

  it('creates a hosted key form for apps without managed OAuth', async () => {
    const { fetch, composio } = client([{ items: [] }, { auth_config: { id: 'ac_new' } }]);

    await composio.ensureAuthConfig({
      slug: 'paystack',
      name: 'Paystack',
      auth_schemes: ['API_KEY'],
      composio_managed_auth_schemes: [],
    });

    expect(call(fetch, 1).body).toEqual({
      toolkit: { slug: 'paystack' },
      auth_config: {
        type: 'use_custom_auth',
        authScheme: 'API_KEY',
        name: 'Finora Paystack',
        credentials: {},
      },
    });
  });

  it("uses Composio's managed OAuth when available", async () => {
    const { fetch, composio } = client([{ items: [] }, { auth_config: { id: 'ac_new' } }]);

    await composio.ensureAuthConfig({
      slug: 'quickbooks',
      name: 'QuickBooks',
      auth_schemes: ['OAUTH2'],
      composio_managed_auth_schemes: ['OAUTH2'],
    });

    expect(call(fetch, 1).body.auth_config).toEqual({
      type: 'use_composio_managed_auth',
      name: 'Finora QuickBooks',
    });
  });

  it('pins tool execution to the schema version', async () => {
    const { fetch, composio } = client([{ data: { ok: 1 }, successful: true, error: null }]);

    await expect(
      composio.executeTool(
        { slug: 'PAYSTACK_FETCH_BALANCE', version: '20260615_00' },
        { userId: 'user_1', arguments: {} },
      ),
    ).resolves.toEqual({ ok: 1 });
    expect(call(fetch).url).toContain('/tools/execute/PAYSTACK_FETCH_BALANCE');
    expect(call(fetch).body).toEqual({ user_id: 'user_1', version: '20260615_00', arguments: {} });
  });

  it('turns an unsuccessful execution into an error', async () => {
    const { composio } = client([{ data: null, successful: false, error: 'Invalid key' }]);

    await expect(
      composio.executeTool({ slug: 'X', version: '1' }, { userId: 'u', arguments: {} }),
    ).rejects.toEqual(new ComposioError('Invalid key', 502, 'tool_failed'));
  });

  it('surfaces API errors with their status and slug', async () => {
    const { composio } = client(
      [{ error: { message: 'No connected account', slug: 'ConnectedAccountNotFound' } }],
      404,
    );

    const error = await composio.getTool('X').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ComposioError);
    expect(error).toMatchObject({ status: 404, code: 'ConnectedAccountNotFound' });
  });
});

describe('isConnectable', () => {
  it('needs managed OAuth or a credential Composio can collect', () => {
    expect(isConnectable({ slug: 'a', name: 'A', composio_managed_auth_schemes: ['OAUTH2'] })).toBe(
      true,
    );
    expect(isConnectable({ slug: 'b', name: 'B', auth_schemes: ['API_KEY'] })).toBe(true);
    expect(isConnectable({ slug: 'c', name: 'C', auth_schemes: ['OAUTH2'] })).toBe(false);
    expect(isConnectable({ slug: 'd', name: 'D', no_auth: true })).toBe(false);
  });
});

describe('isReadOnlyTool', () => {
  const tool: ComposioTool = {
    slug: 'PAYSTACK_LIST_TRANSACTIONS',
    name: 'List',
    version: '1',
    toolkit: { slug: 'paystack' },
    tags: ['readOnlyHint'],
  };

  it('allows only tools Composio marks read-only', () => {
    expect(isReadOnlyTool(tool)).toBe(true);
    expect(isReadOnlyTool({ ...tool, tags: ['openWorldHint'] })).toBe(false);
    expect(isReadOnlyTool({ ...tool, is_deprecated: true })).toBe(false);
  });
});
