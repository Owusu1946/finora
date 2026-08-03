import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_INPUT_SCHEMAS, TOOL_NAMES, type ToolName } from '@finora/shared';
import { McpAgent } from 'agents/mcp';
import type { ZodRawShape } from 'zod';

import { TOOL_CATALOG } from './tools/catalog';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

async function callFinoraApi(
  env: Env,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
) {
  const base = env.FINORA_API_URL.replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await response.json().catch(() => ({
    error: 'invalid_json',
    status: response.status,
  }));
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      data,
    };
  }
  return { ok: true as const, status: response.status, data };
}

/**
 * Remote MCP surface for external AI agents.
 * All tools call Finora API — never WeWire directly.
 * Money tools only prepare + request approval; humans confirm in the app.
 */
export class FinoraMCP extends McpAgent<Env> {
  server = new McpServer({
    name: 'finora',
    version: '0.1.0',
  });

  async init() {
    for (const name of TOOL_NAMES) {
      this.registerTool(name);
    }
  }

  private registerTool(name: ToolName) {
    const meta = TOOL_CATALOG[name];
    const schema = TOOL_INPUT_SCHEMAS[name];
    const shape = (schema as unknown as { shape: ZodRawShape }).shape ?? {};

    this.server.tool(name, meta.description, shape, async (args) => {
      if (name === 'ping') {
        const message = (args as { message?: string }).message;
        return textResult({
          pong: true,
          message: message ? `pong: ${message}` : 'pong',
          tools: TOOL_NAMES.length,
        });
      }

      const path =
        typeof meta.path === 'function'
          ? meta.path(args as Record<string, unknown>)
          : meta.path;

      // Strip path-param fields from body where needed
      const bodyArgs = { ...(args as Record<string, unknown>) };
      if (meta.body) {
        delete bodyArgs.subCustomerId;
        delete bodyArgs.invoiceId;
        delete bodyArgs.recurringId;
        delete bodyArgs.approvalId;
        delete bodyArgs.transactionId;
      }

      try {
        const result = await callFinoraApi(
          this.env,
          meta.method,
          path,
          meta.body ? bodyArgs : undefined,
        );
        return textResult({
          tool: name,
          ...result,
        });
      } catch (error) {
        return textResult({
          tool: name,
          ok: false,
          error: error instanceof Error ? error.message : 'request_failed',
          hint: 'Is Finora API running? Set FINORA_API_URL in wrangler / .dev.vars',
        });
      }
    });
  }
}
