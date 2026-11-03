import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { beginCalendarConnection } from './calendar-integration-api';
import { beginDriveConnection } from './drive-integration-api';
import { beginGmailConnection } from './gmail-integration-api';

type GetToken = () => Promise<string | null>;

export type GoogleApp = 'gmail' | 'googledrive' | 'googlecalendar';

const FLOWS = {
  gmail: { begin: beginGmailConnection, param: 'gmail' },
  googledrive: { begin: beginDriveConnection, param: 'drive' },
  googlecalendar: { begin: beginCalendarConnection, param: 'calendar' },
} satisfies Record<GoogleApp, unknown>;

export function isGoogleApp(app: string): app is GoogleApp {
  return app in FLOWS;
}

/**
 * Runs Finora's own Google OAuth for Gmail, Drive, or Calendar (the same flow
 * as Integrations). Resolves true once Google reports it connected.
 */
export async function connectGoogleApp(getToken: GetToken, app: GoogleApp) {
  const flow = FLOWS[app];
  const returnUrl = Linking.createURL('/integrations');
  const { authorizationUrl } = await flow.begin(getToken, returnUrl);
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl);
  if (result.type !== 'success') return false;
  const outcome = new URL(result.url).searchParams.get(flow.param);
  if (outcome === 'failed') throw new Error('Google did not finish connecting. Try again.');
  return outcome === 'connected';
}
