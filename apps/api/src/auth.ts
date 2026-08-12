import { getAuth } from '@clerk/hono';
import { createMiddleware } from 'hono/factory';

export const requireSession = createMiddleware(async (c, next) => {
  const auth = getAuth(c, { acceptsToken: 'session_token' });
  if (!auth.isAuthenticated || !auth.userId || !auth.sessionId) {
    return c.json({ error: 'unauthorized', message: 'A valid Clerk session is required.' }, 401);
  }

  await next();
});
