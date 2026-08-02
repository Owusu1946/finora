import { FinoraMCP } from './server';

export { FinoraMCP };

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === '/mcp') {
      return FinoraMCP.serve('/mcp').fetch(request, env, ctx);
    }

    if (url.pathname === '/sse' || url.pathname === '/sse/message') {
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
