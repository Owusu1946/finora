import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';

/**
 * Remote MCP surface for external AI agents.
 * Tools call Finora API — never WeWire directly.
 */
export class FinoraMCP extends McpAgent<Env> {
  server = new McpServer({
    name: 'finora',
    version: '0.0.1',
  });

  async init() {
    this.server.tool(
      'get_balances',
      'Get wallet balances for the authenticated Finora account',
      {},
      async () => {
        const response = await fetch(`${this.env.FINORA_API_URL}/v1/balances`);
        const data = await response.json();
        return {
          content: [{ type: 'text', text: JSON.stringify(data) }],
        };
      },
    );

    this.server.tool(
      'search_contacts',
      'Search saved contacts / beneficiaries by name',
      { query: z.string().min(1) },
      async ({ query }) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'not_implemented',
              query,
              message: 'Contact search will call Finora API next.',
            }),
          },
        ],
      }),
    );

    this.server.tool(
      'prepare_payment',
      'Prepare a payment for human approval. Does not move money.',
      {
        contactId: z.string().optional(),
        beneficiaryAccountId: z.string().uuid().optional(),
        amount: z.number().positive(),
        currency: z.enum(['USD', 'EUR', 'GBP', 'GHS', 'USDT', 'USDC']),
        reference: z.string().max(140).optional(),
        description: z.string().max(280).optional(),
      },
      async (input) => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'pending_approval',
              preparation: input,
              message: 'Payment prepared. User must approve in the Finora app before execution.',
            }),
          },
        ],
      }),
    );

    this.server.tool(
      'ping',
      'Health check for the Finora MCP server',
      { message: z.string().optional() },
      async ({ message }) => ({
        content: [
          {
            type: 'text',
            text: message ? `pong: ${message}` : 'pong',
          },
        ],
      }),
    );
  }
}
