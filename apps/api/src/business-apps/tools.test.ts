import { describe, expect, it, vi } from 'vitest';

import { ComposioError, type ComposioTool } from './composio';
import { businessAppsPrompt, createBusinessAppTools, type BusinessAppsToolContext } from './tools';

const NOW = new Date('2026-10-30T12:00:00.000Z');

function schema(slug: string, readOnly = true): ComposioTool {
  return {
    slug,
    name: slug,
    version: '20260615_00',
    toolkit: { slug: slug.split('_')[0]!.toLowerCase() },
    tags: readOnly ? ['readOnlyHint'] : ['openWorldHint'],
  };
}

function setup(connected: string[], results: Record<string, unknown> = {}) {
  const composio = {
    getTool: vi.fn(async (slug: string) => {
      if (slug === 'NOPE_ACTION') throw new ComposioError('Not found', 404);
      return schema(slug, !slug.includes('REFUND') && !slug.includes('SEND'));
    }),
    getToolkit: vi.fn(async (slug: string) => {
      if (slug !== 'xero') throw new ComposioError('Toolkit not found', 404);
      return {
        slug: 'xero',
        name: 'Xero',
        auth_schemes: ['OAUTH2'],
        meta: { logo: 'https://logos.composio.dev/api/xero' },
      };
    }),
    searchTools: vi.fn(async () => [
      {
        ...schema('QUICKBOOKS_LIST_INVOICES'),
        input_parameters: { properties: { max_results: { type: 'integer' } } },
      },
      schema('QUICKBOOKS_CREATE_INVOICE', false),
    ]),
    executeTool: vi.fn(async (tool: Pick<ComposioTool, 'slug'>) => {
      const result = results[tool.slug];
      if (result instanceof Error) throw result;
      return result ?? {};
    }),
  } satisfies BusinessAppsToolContext['composio'];
  const tools = createBusinessAppTools({ composio, userId: 'user_1', connected, now: () => NOW });
  return { composio, tools };
}

async function run(
  tools: ReturnType<typeof setup>['tools'],
  name: keyof typeof tools,
  input: object,
) {
  const execute = tools[name].execute as unknown as (
    input: object,
    options: object,
  ) => Promise<Record<string, unknown>>;
  return execute(input, { toolCallId: 'call_1', messages: [] });
}

describe('get_business_payments', () => {
  it('combines connected payment apps and totals per currency', async () => {
    const { composio, tools } = setup(['paystack', 'flutterwave', 'whatsapp'], {
      PAYSTACK_LIST_TRANSACTIONS: {
        data: {
          data: [
            {
              id: 1,
              amount: 50_000,
              currency: 'GHS',
              status: 'success',
              paid_at: '2026-10-29T09:00:00Z',
            },
            {
              id: 2,
              amount: 20_000,
              currency: 'GHS',
              status: 'success',
              paid_at: '2026-10-01T09:00:00Z',
            },
          ],
        },
      },
      FLUTTERWAVE_GET_ALL_TRANSACTIONS: {
        data: [
          {
            id: 9,
            amount: 1_000,
            currency: 'NGN',
            status: 'successful',
            created_at: '2026-10-30T08:00:00Z',
          },
        ],
      },
    });

    const result = await run(tools, 'get_business_payments', { days: 7 });

    expect(result.totals).toEqual([
      { currency: 'NGN', total: 1_000, count: 1 },
      { currency: 'GHS', total: 500, count: 1 },
    ]);
    expect(result.paymentCount).toBe(2);
    expect(composio.executeTool).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'PAYSTACK_LIST_TRANSACTIONS' }),
      {
        userId: 'user_1',
        arguments: { from_date: '2026-10-23T12:00:00.000Z', per_page: 100, status: 'success' },
      },
    );
    // Stripe isn't connected, so it is never called.
    expect(composio.getTool).not.toHaveBeenCalledWith('STRIPE_LIST_CHARGES');
  });

  it('reports one failing app without hiding the others', async () => {
    const { tools } = setup(['paystack', 'stripe'], {
      PAYSTACK_LIST_TRANSACTIONS: new ComposioError('Invalid key', 502, 'tool_failed'),
      STRIPE_LIST_CHARGES: {
        data: [{ id: 'ch_1', amount: 1_000, currency: 'usd', status: 'succeeded' }],
      },
    });

    const result = await run(tools, 'get_business_payments', {});

    expect(result.ok).toBe(true);
    expect(result.sources).toEqual([
      { app: 'paystack', ok: false, errorCode: 'app_returned_error' },
      { app: 'stripe', ok: true, count: 1 },
    ]);
  });

  it('says when no payment app is connected', async () => {
    const { tools } = setup(['whatsapp']);
    expect(await run(tools, 'get_business_payments', {})).toEqual({
      ok: false,
      errorCode: 'no_payment_app_connected',
      connectOptions: ['paystack', 'flutterwave', 'stripe'].map((app) => ({
        app,
        name: expect.any(String),
        logo: `https://logos.composio.dev/api/${app}`,
        kind: 'business',
        connectable: true,
      })),
    });
  });
});

describe('get_business_balances', () => {
  it('reads balances from each connected payment app', async () => {
    const { tools } = setup(['paystack'], {
      PAYSTACK_FETCH_BALANCE: { data: { data: [{ currency: 'GHS', balance: 12_345 }] } },
    });
    expect(await run(tools, 'get_business_balances', {})).toEqual({
      ok: true,
      balances: [{ app: 'paystack', currency: 'GHS', available: 123.45, pending: null }],
      sources: [{ app: 'paystack', ok: true }],
    });
  });
});

describe('find_app_actions', () => {
  it('returns only read-only actions for a connected app', async () => {
    const { tools } = setup(['quickbooks']);
    const result = await run(tools, 'find_app_actions', {
      app: 'quickbooks',
      query: 'unpaid invoices',
    });
    expect(result.actions).toEqual([
      {
        action: 'QUICKBOOKS_LIST_INVOICES',
        description: 'QUICKBOOKS_LIST_INVOICES',
        inputs: ['max_results: integer'],
      },
    ]);
  });

  it('refuses apps the user has not connected', async () => {
    const { tools } = setup([]);
    expect(await run(tools, 'find_app_actions', { app: 'quickbooks', query: 'invoices' })).toEqual({
      ok: false,
      errorCode: 'app_not_connected',
      app: 'quickbooks',
      connectOptions: [
        {
          app: 'quickbooks',
          name: 'QuickBooks',
          logo: 'https://logos.composio.dev/api/quickbooks',
          kind: 'business',
          connectable: true,
        },
      ],
    });
  });

  it('offers any real Composio app, marking ones Finora cannot connect yet', async () => {
    const { tools } = setup([]);
    const result = await run(tools, 'find_app_actions', { app: 'xero', query: 'invoices' });
    expect(result.connectOptions).toEqual([
      {
        app: 'xero',
        name: 'Xero',
        logo: 'https://logos.composio.dev/api/xero',
        kind: 'business',
        connectable: false,
      },
    ]);
  });

  it('shows no card for an app that does not exist', async () => {
    const { tools } = setup([]);
    expect(await run(tools, 'find_app_actions', { app: 'my_books', query: 'x' })).toMatchObject({
      errorCode: 'unknown_app',
      connectOptions: [],
    });
  });
});

describe('run_app_action', () => {
  it('runs a read-only action', async () => {
    const { tools } = setup(['quickbooks'], { QUICKBOOKS_LIST_INVOICES: { invoices: [1] } });
    expect(await run(tools, 'run_app_action', { action: 'QUICKBOOKS_LIST_INVOICES' })).toEqual({
      ok: true,
      app: 'quickbooks',
      action: 'QUICKBOOKS_LIST_INVOICES',
      truncated: false,
      data: { invoices: [1] },
    });
  });

  it('never runs actions that change data or move money', async () => {
    const { composio, tools } = setup(['paystack']);
    expect(await run(tools, 'run_app_action', { action: 'PAYSTACK_CREATE_REFUND' })).toMatchObject({
      ok: false,
      errorCode: 'action_not_allowed',
    });
    expect(composio.executeTool).not.toHaveBeenCalled();
  });

  it('refuses actions in apps the user has not connected', async () => {
    const { composio, tools } = setup(['paystack']);
    expect(
      await run(tools, 'run_app_action', { action: 'QUICKBOOKS_LIST_INVOICES' }),
    ).toMatchObject({
      ok: false,
      errorCode: 'app_not_connected',
      connectOptions: [{ app: 'quickbooks', kind: 'business' }],
    });
    expect(composio.executeTool).not.toHaveBeenCalled();
  });

  it('reports unknown actions', async () => {
    const { tools } = setup(['paystack']);
    expect(await run(tools, 'run_app_action', { action: 'NOPE_ACTION' })).toMatchObject({
      ok: false,
      errorCode: 'unknown_action',
    });
  });

  it('truncates very large results', async () => {
    const { tools } = setup(['quickbooks'], {
      QUICKBOOKS_LIST_INVOICES: { rows: 'x'.repeat(20_000) },
    });
    const result = await run(tools, 'run_app_action', { action: 'QUICKBOOKS_LIST_INVOICES' });
    expect(result.truncated).toBe(true);
    expect(String(result.data).length).toBeLessThan(12_100);
  });
});

describe('draft_whatsapp_message', () => {
  it('only drafts', async () => {
    const { composio, tools } = setup(['whatsapp']);
    expect(
      await run(tools, 'draft_whatsapp_message', { to: '+233241234567', text: 'Thanks Ama!' }),
    ).toEqual({ status: 'draft', to: '+233241234567', text: 'Thanks Ama!' });
    expect(composio.executeTool).not.toHaveBeenCalled();
  });

  it('flags a missing WhatsApp connection', async () => {
    const { tools } = setup([]);
    expect(
      await run(tools, 'draft_whatsapp_message', { to: '+233241234567', text: 'Hi' }),
    ).toMatchObject({
      status: 'not_connected',
      app: 'whatsapp',
      connectOptions: [{ app: 'whatsapp', kind: 'business' }],
    });
  });
});

describe('suggest_app_connection', () => {
  it('routes Google apps to the native Google connect flow', async () => {
    const { composio, tools } = setup([]);
    expect(
      await run(tools, 'suggest_app_connection', { app: 'google_calendar', reason: 'See dues' }),
    ).toMatchObject({
      ok: true,
      app: 'googlecalendar',
      connectOptions: [{ app: 'googlecalendar', kind: 'google', connectable: true }],
    });
    expect(composio.getToolkit).not.toHaveBeenCalled();
  });

  it('reports a connected business app as connected', async () => {
    const { tools } = setup(['paystack']);
    expect(
      await run(tools, 'suggest_app_connection', { app: 'paystack', reason: 'Sales' }),
    ).toMatchObject({ connected: true, name: 'Paystack' });
  });
});

describe('businessAppsPrompt', () => {
  it('lists connected apps with their guides and the rest as not connected', () => {
    const prompt = businessAppsPrompt(['paystack', 'docusign']);
    expect(prompt).toContain('- Paystack (paystack): Source of truth for customer payments');
    expect(prompt).toContain('- Docusign (docusign): connected.');
    expect(prompt).toMatch(/Not connected: Flutterwave \(flutterwave\), Stripe/);
    expect(prompt).not.toMatch(/Not connected:.*Paystack/);
  });

  it('says when nothing is connected', () => {
    expect(businessAppsPrompt([])).toContain('has not connected any business apps yet');
  });
});
