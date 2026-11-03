import { z } from 'zod';

const COMPOSIO_BASE_URL = 'https://backend.composio.dev/api/v3';
const REQUEST_TIMEOUT_MS = 15_000;

const ToolkitSchema = z.object({
  slug: z.string(),
  name: z.string(),
  no_auth: z.boolean().optional(),
  auth_schemes: z.array(z.string()).optional(),
  composio_managed_auth_schemes: z.array(z.string()).optional(),
  meta: z
    .object({
      description: z.string().nullable().optional(),
      logo: z.string().nullable().optional(),
    })
    .optional(),
});
export type ComposioToolkit = z.infer<typeof ToolkitSchema>;

const ToolkitPageSchema = z.object({
  items: z.array(ToolkitSchema),
  next_cursor: z.string().nullable().optional(),
});

const ToolkitDetailSchema = ToolkitSchema.extend({
  auth_config_details: z.array(z.object({ mode: z.string() })).optional(),
});

const AuthConfigListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      is_composio_managed: z.boolean().optional(),
      status: z.string().optional(),
    }),
  ),
});

const CreatedAuthConfigSchema = z.object({ auth_config: z.object({ id: z.string() }) });

const LinkSchema = z.object({ redirect_url: z.url(), connected_account_id: z.string() });

const ConnectedAccountSchema = z.object({
  id: z.string(),
  status: z.string(),
  toolkit: z.object({ slug: z.string() }),
  created_at: z.string().optional(),
});
export type ComposioConnectedAccount = z.infer<typeof ConnectedAccountSchema>;

const ConnectedAccountPageSchema = z.object({
  items: z.array(ConnectedAccountSchema),
  next_cursor: z.string().nullable().optional(),
});

const ToolSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  tags: z.array(z.string()).optional(),
  toolkit: z.object({ slug: z.string() }),
  input_parameters: z.record(z.string(), z.unknown()).optional(),
  is_deprecated: z.boolean().optional(),
});
export type ComposioTool = z.infer<typeof ToolSchema>;

const ToolPageSchema = z.object({ items: z.array(ToolSchema) });

const ExecutionSchema = z.object({
  data: z.unknown(),
  successful: z.boolean(),
  error: z.string().nullable().optional(),
});

export class ComposioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ComposioError';
  }
}

/** Auth schemes Composio's hosted Connect Link can collect without our own OAuth app. */
const HOSTED_CREDENTIAL_SCHEMES = new Set(['API_KEY', 'BEARER_TOKEN', 'BASIC']);

/** Whether a user can connect this toolkit with Finora's current Composio setup. */
export function isConnectable(toolkit: ComposioToolkit) {
  if (toolkit.no_auth) return false;
  if ((toolkit.composio_managed_auth_schemes ?? []).length > 0) return true;
  return (toolkit.auth_schemes ?? []).some((scheme) => HOSTED_CREDENTIAL_SCHEMES.has(scheme));
}

/** Read-only per Composio's tool annotations. Only these may run without the user. */
export function isReadOnlyTool(tool: ComposioTool) {
  return (tool.tags ?? []).includes('readOnlyHint') && !tool.is_deprecated;
}

/**
 * Thin client for Composio's v3 REST API. Composio stores the connected
 * accounts and their credentials; Finora never sees a user's app secrets.
 */
export function createComposioClient(options: { apiKey: string; fetch?: typeof fetch }) {
  const doFetch = options.fetch ?? fetch;

  async function request(
    path: string,
    init?: { method?: string; query?: Record<string, string | undefined>; body?: unknown },
  ) {
    const url = new URL(`${COMPOSIO_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(init?.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await doFetch(url, {
        method: init?.method ?? 'GET',
        headers: {
          'x-api-key': options.apiKey,
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = z
          .object({ error: z.object({ message: z.string(), slug: z.string().optional() }) })
          .safeParse(payload);
        throw new ComposioError(
          error.success
            ? error.data.error.message
            : `Composio request failed with status ${response.status}.`,
          response.status,
          error.success ? error.data.error.slug : undefined,
        );
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async listToolkits(input: { search?: string; cursor?: string; limit: number }) {
      const page = ToolkitPageSchema.parse(
        await request('/toolkits', {
          query: {
            search: input.search,
            cursor: input.cursor,
            limit: String(input.limit),
            sort_by: 'usage',
          },
        }),
      );
      return { toolkits: page.items, nextCursor: page.next_cursor ?? null };
    },

    async getToolkit(slug: string) {
      const toolkit = ToolkitDetailSchema.parse(
        await request(`/toolkits/${encodeURIComponent(slug)}`),
      );
      // The single-toolkit endpoint lists schemes under auth_config_details instead.
      return {
        ...toolkit,
        auth_schemes:
          toolkit.auth_schemes ?? toolkit.auth_config_details?.map((detail) => detail.mode),
      };
    },

    /**
     * Finora's auth config for a toolkit, created on first use. Uses Composio's
     * managed OAuth app when there is one, else the hosted credential form.
     */
    async ensureAuthConfig(toolkit: ComposioToolkit) {
      const existing = AuthConfigListSchema.parse(
        await request('/auth_configs', { query: { toolkit_slug: toolkit.slug, limit: '10' } }),
      ).items.find((config) => config.status !== 'DISABLED');
      if (existing) return existing.id;

      const managed = (toolkit.composio_managed_auth_schemes ?? []).length > 0;
      const scheme = (toolkit.auth_schemes ?? []).find((value) =>
        HOSTED_CREDENTIAL_SCHEMES.has(value),
      );
      const created = CreatedAuthConfigSchema.parse(
        await request('/auth_configs', {
          method: 'POST',
          body: {
            toolkit: { slug: toolkit.slug },
            auth_config: managed
              ? { type: 'use_composio_managed_auth', name: `Finora ${toolkit.name}` }
              : {
                  type: 'use_custom_auth',
                  authScheme: scheme,
                  name: `Finora ${toolkit.name}`,
                  credentials: {},
                },
          },
        }),
      );
      return created.auth_config.id;
    },

    /** Hosted page where the user signs in to the app or pastes its key. */
    async createConnectLink(input: { authConfigId: string; userId: string; callbackUrl: string }) {
      return LinkSchema.parse(
        await request('/connected_accounts/link', {
          method: 'POST',
          body: {
            auth_config_id: input.authConfigId,
            user_id: input.userId,
            callback_url: input.callbackUrl,
          },
        }),
      );
    },

    async listConnectedAccounts(userId: string) {
      const accounts: ComposioConnectedAccount[] = [];
      let cursor: string | undefined;
      // A user has a handful of apps; two pages is plenty and bounds the loop.
      for (let page = 0; page < 2; page += 1) {
        const result = ConnectedAccountPageSchema.parse(
          await request('/connected_accounts', {
            query: { user_ids: userId, limit: '100', cursor },
          }),
        );
        accounts.push(...result.items);
        if (!result.next_cursor) break;
        cursor = result.next_cursor;
      }
      return accounts;
    },

    async deleteConnectedAccount(id: string) {
      await request(`/connected_accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getTool(slug: string) {
      return ToolSchema.parse(
        await request(`/tools/${encodeURIComponent(slug)}`, {
          query: { toolkit_versions: 'latest' },
        }),
      );
    },

    async searchTools(input: { toolkit: string; search: string; limit: number }) {
      return ToolPageSchema.parse(
        await request('/tools', {
          query: {
            toolkit_slug: input.toolkit,
            search: input.search,
            limit: String(input.limit),
            toolkit_versions: 'latest',
          },
        }),
      ).items;
    },

    /** Runs a tool as the user, pinned to the version its schema came from. */
    async executeTool(
      tool: Pick<ComposioTool, 'slug' | 'version'>,
      input: { userId: string; arguments: Record<string, unknown> },
    ) {
      const result = ExecutionSchema.parse(
        await request(`/tools/execute/${encodeURIComponent(tool.slug)}`, {
          method: 'POST',
          body: { user_id: input.userId, version: tool.version, arguments: input.arguments },
        }),
      );
      if (!result.successful) {
        throw new ComposioError(result.error ?? 'The app returned an error.', 502, 'tool_failed');
      }
      return result.data;
    },
  };
}

export type ComposioClient = ReturnType<typeof createComposioClient>;
