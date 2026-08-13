import { createMcpEnv } from '@finora/env/mcp';

import { requireClerkSession, unauthorizedResponse } from './auth';
import { FinoraMCP } from './server';

export { FinoraMCP };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const validatedEnv = createMcpEnv({
      ENVIRONMENT: env.ENVIRONMENT,
      FINORA_API_URL: env.FINORA_API_URL,
      CLERK_SECRET_KEY: env.CLERK_SECRET_KEY,
      CLERK_PUBLISHABLE_KEY: env.CLERK_PUBLISHABLE_KEY,
    });
    const url = new URL(request.url);

    if (url.pathname === '/mcp') {
      if (!(await requireClerkSession(request, validatedEnv))) return unauthorizedResponse();
      return FinoraMCP.serve('/mcp').fetch(request, env, ctx);
    }

    if (url.pathname === '/sse' || url.pathname === '/sse/message') {
      if (!(await requireClerkSession(request, validatedEnv))) return unauthorizedResponse();
      return FinoraMCP.serveSSE('/sse').fetch(request, env, ctx);
    }

    return Response.json({
      name: 'finora-mcp',
      status: 'ok',
      endpoints: {
        mcp: '/mcp',
        sse: '/sse',
      },
    });
  },
};
