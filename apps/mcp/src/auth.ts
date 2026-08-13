import type { McpEnv } from '@finora/env/mcp';

import { verifyToken } from '@clerk/backend';

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

export function getBearerToken(request: Request) {
  return request.headers.get('Authorization')?.match(BEARER_PATTERN)?.[1]?.trim() ?? null;
}

export async function requireClerkSession(request: Request, env: McpEnv) {
  const token = getBearerToken(request);
  if (!token) return null;

  try {
    const claims = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    if (!claims.sub || !claims.sid) return null;
    return { token, userId: claims.sub, sessionId: claims.sid };
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return Response.json(
    { error: 'unauthorized', message: 'A valid Clerk session bearer token is required.' },
    { status: 401 },
  );
}
