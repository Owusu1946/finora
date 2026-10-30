import { ConnectBusinessAppRequestSchema, SendWhatsAppMessageRequestSchema } from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import {
  AppNotConnectableError,
  browseApps,
  composioFor,
  createAppConnectLink,
  disconnectApp,
  listCuratedApps,
  logComposioError,
  sendApprovedWhatsAppMessage,
  validMobileReturnUrl,
  WhatsAppNumberMissingError,
} from '../business-apps/service';

export const businessApps = new Hono<AppEnv>();

const NO_STORE = { 'Cache-Control': 'no-store' };
const SLUG_PATTERN = /^[a-z0-9_]+$/;

const unavailable = {
  error: 'apps_unavailable',
  message: 'Business apps are not configured.',
} as const;
const providerFailed = {
  error: 'apps_provider_error',
  message: "Couldn't reach the app service. Try again.",
} as const;

businessApps.get('/', async (c) => {
  const composio = composioFor(c.get('env'));
  if (!composio) return c.json(unavailable, 503, NO_STORE);
  try {
    return c.json({ apps: await listCuratedApps(composio, c.get('auth').userId) }, 200, NO_STORE);
  } catch (error) {
    logComposioError('list', error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});

businessApps.get('/browse', async (c) => {
  const composio = composioFor(c.get('env'));
  if (!composio) return c.json(unavailable, 503, NO_STORE);
  const search = c.req.query('search')?.trim().slice(0, 80) || undefined;
  const cursor = c.req.query('cursor')?.slice(0, 200) || undefined;
  try {
    return c.json(
      await browseApps(composio, c.get('auth').userId, { search, cursor }),
      200,
      NO_STORE,
    );
  } catch (error) {
    logComposioError('browse', error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});

businessApps.post('/:slug/connect', async (c) => {
  const env = c.get('env');
  const composio = composioFor(env);
  if (!composio) return c.json(unavailable, 503, NO_STORE);
  const slug = c.req.param('slug');
  if (!SLUG_PATTERN.test(slug)) return c.json({ error: 'invalid_app' }, 400, NO_STORE);

  const body = ConnectBusinessAppRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'invalid_request' }, 400, NO_STORE);
  const returnUrl = validMobileReturnUrl(body.data.returnUrl, env.ENVIRONMENT);
  if (!returnUrl) return c.json({ error: 'invalid_return_url' }, 400, NO_STORE);

  try {
    const url = await createAppConnectLink(composio, {
      userId: c.get('auth').userId,
      slug,
      returnUrl,
    });
    return c.json({ url }, 200, NO_STORE);
  } catch (error) {
    if (error instanceof AppNotConnectableError) {
      return c.json(
        { error: 'app_not_connectable', message: "Finora can't connect this app yet." },
        409,
        NO_STORE,
      );
    }
    logComposioError('connect', error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});

businessApps.delete('/:slug', async (c) => {
  const composio = composioFor(c.get('env'));
  if (!composio) return c.json(unavailable, 503, NO_STORE);
  const slug = c.req.param('slug');
  if (!SLUG_PATTERN.test(slug)) return c.json({ error: 'invalid_app' }, 400, NO_STORE);
  try {
    await disconnectApp(composio, c.get('auth').userId, slug);
    return c.json({ disconnected: true }, 200, NO_STORE);
  } catch (error) {
    logComposioError('disconnect', error);
    return c.json(providerFailed, 502, NO_STORE);
  }
});

/** Sends a WhatsApp draft after the user taps Send on it. The model can only draft. */
businessApps.post('/whatsapp/messages', async (c) => {
  const composio = composioFor(c.get('env'));
  if (!composio) return c.json(unavailable, 503, NO_STORE);
  const body = SendWhatsAppMessageRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'invalid_request' }, 400, NO_STORE);
  try {
    await sendApprovedWhatsAppMessage(composio, { userId: c.get('auth').userId, ...body.data });
    return c.json({ sent: true }, 200, NO_STORE);
  } catch (error) {
    if (error instanceof WhatsAppNumberMissingError) {
      return c.json({ error: 'whatsapp_number_missing', message: error.message }, 409, NO_STORE);
    }
    logComposioError('whatsapp-send', error);
    return c.json(
      {
        error: 'whatsapp_send_failed',
        message:
          "WhatsApp didn't send it. Customers who haven't messaged you in the last 24 hours need an approved template.",
      },
      502,
      NO_STORE,
    );
  }
});
