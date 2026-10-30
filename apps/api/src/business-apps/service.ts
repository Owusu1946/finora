import { CURATED_BUSINESS_APPS, curatedBusinessApp, type BusinessApp } from '@finora/shared';

import type { AppApiEnv } from '../env';

import {
  ComposioError,
  createComposioClient,
  isConnectable,
  type ComposioClient,
  type ComposioToolkit,
} from './composio';
import { appStatuses, findList } from './normalize';

/** Composio client for this environment, or null when business apps are not configured. */
export function composioFor(env: AppApiEnv) {
  if (!env.COMPOSIO_API_KEY) return null;
  return createComposioClient({ apiKey: env.COMPOSIO_API_KEY });
}

export function logComposioError(scope: string, error: unknown) {
  console.error(`[apps:${scope}]`, {
    errorName: error instanceof Error ? error.name : typeof error,
    status: error instanceof ComposioError ? error.status : undefined,
    code: error instanceof ComposioError ? error.code : undefined,
  });
}

export class AppNotConnectableError extends Error {
  constructor(readonly slug: string) {
    super(`${slug} can't be connected yet.`);
    this.name = 'AppNotConnectableError';
  }
}

function logoFor(slug: string) {
  return `https://logos.composio.dev/api/${encodeURIComponent(slug)}`;
}

/** Composio descriptions sometimes arrive double-encoded ("Googleâ€™s"). */
function repairText(value: string) {
  return value
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€\u009d/g, '"')
    .replace(/â€“|â€”/g, '-')
    .trim();
}

/** Only links back into the app are allowed as the post-connect redirect. */
export function validMobileReturnUrl(value: string, environment: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'finora:') return value;
    if (environment !== 'production' && url.protocol === 'exp:') return value;
    return null;
  } catch {
    return null;
  }
}

/** The curated business apps with this user's connection status. */
export async function listCuratedApps(composio: ComposioClient, userId: string) {
  const statuses = appStatuses(await composio.listConnectedAccounts(userId));
  return CURATED_BUSINESS_APPS.map((app): BusinessApp => ({
    slug: app.slug,
    name: app.name,
    logo: logoFor(app.slug),
    description: app.description,
    category: app.category,
    status: statuses.get(app.slug) ?? 'disconnected',
    connectable: true,
  }));
}

function toBusinessApp(toolkit: ComposioToolkit, statuses: ReturnType<typeof appStatuses>) {
  const curated = curatedBusinessApp(toolkit.slug);
  return {
    slug: toolkit.slug,
    name: curated?.name ?? toolkit.name,
    logo: toolkit.meta?.logo ?? logoFor(toolkit.slug),
    description: curated?.description ?? repairText(toolkit.meta?.description ?? ''),
    category: curated?.category ?? null,
    status: statuses.get(toolkit.slug) ?? 'disconnected',
    connectable: isConnectable(toolkit),
  } satisfies BusinessApp;
}

/** Every app Composio offers, most used first, searchable. */
export async function browseApps(
  composio: ComposioClient,
  userId: string,
  input: { search?: string; cursor?: string },
) {
  const [page, accounts] = await Promise.all([
    composio.listToolkits({ search: input.search, cursor: input.cursor, limit: 30 }),
    composio.listConnectedAccounts(userId),
  ]);
  const statuses = appStatuses(accounts);
  return {
    apps: page.toolkits.map((toolkit) => toBusinessApp(toolkit, statuses)),
    nextCursor: page.nextCursor,
  };
}

/** Slugs of the apps this user has a working connection to. */
export async function connectedAppSlugs(composio: ComposioClient, userId: string) {
  const statuses = appStatuses(await composio.listConnectedAccounts(userId));
  return [...statuses].filter(([, status]) => status === 'connected').map(([slug]) => slug);
}

/**
 * A hosted Composio page where the user signs in to the app (OAuth) or pastes
 * its API key. Finora never handles the credential itself.
 */
export async function createAppConnectLink(
  composio: ComposioClient,
  input: { userId: string; slug: string; returnUrl: string },
) {
  const toolkit = await composio.getToolkit(input.slug);
  if (!isConnectable(toolkit)) throw new AppNotConnectableError(input.slug);

  // Clear abandoned or failed attempts so they don't pile up on the user.
  const stale = (await composio.listConnectedAccounts(input.userId)).filter(
    (account) => account.toolkit.slug === input.slug && account.status !== 'ACTIVE',
  );
  await Promise.allSettled(stale.map((account) => composio.deleteConnectedAccount(account.id)));

  const authConfigId = await composio.ensureAuthConfig(toolkit);
  const link = await composio.createConnectLink({
    authConfigId,
    userId: input.userId,
    callbackUrl: input.returnUrl,
  });
  return link.redirect_url;
}

/** Removes every connection the user has to this app. */
export async function disconnectApp(composio: ComposioClient, userId: string, slug: string) {
  const accounts = (await composio.listConnectedAccounts(userId)).filter(
    (account) => account.toolkit.slug === slug,
  );
  await Promise.all(accounts.map((account) => composio.deleteConnectedAccount(account.id)));
  return accounts.length;
}

export class WhatsAppNumberMissingError extends Error {
  constructor() {
    super('The connected WhatsApp Business account has no phone number.');
    this.name = 'WhatsAppNumberMissingError';
  }
}

/**
 * Sends a WhatsApp message the user approved in the app, from the first phone
 * number on their WhatsApp Business account. Never called by the model.
 */
export async function sendApprovedWhatsAppMessage(
  composio: ComposioClient,
  input: { userId: string; to: string; text: string },
) {
  const [numbersTool, sendTool] = await Promise.all([
    composio.getTool('WHATSAPP_GET_PHONE_NUMBERS'),
    composio.getTool('WHATSAPP_SEND_MESSAGE'),
  ]);
  const numbers = findList(
    await composio.executeTool(numbersTool, { userId: input.userId, arguments: {} }),
  );
  const first = numbers[0];
  const phoneNumberId =
    typeof first === 'object' && first !== null && 'id' in first ? String(first.id) : null;
  if (!phoneNumberId) throw new WhatsAppNumberMissingError();

  await composio.executeTool(sendTool, {
    userId: input.userId,
    arguments: {
      phone_number_id: phoneNumberId,
      to_number: input.to.replace(/^\+/, ''),
      text: input.text,
    },
  });
}
