import * as Linking from 'expo-linking';
import type { Router } from 'expo-router';

import {
  buildScanPayPrompt,
  parsePaymentQr,
} from '@/lib/payment-qr';
import type { ThreadSender } from '@/lib/send-chat-prompt';
import { sendChatPrompt } from '@/lib/send-chat-prompt';

const PREP_ID = /(?:pay\.finora\.app\/r\/|\/pay\/r\/|finora:\/\/pay\/r\/)([A-Za-z0-9_-]+)/i;

/** Extract preparation id from https, finora://, or Expo path URLs. */
export function preparationIdFromUrl(url: string): string | null {
  const m = url.trim().match(PREP_ID);
  return m?.[1] ?? null;
}

/** App-openable deep link (works in Expo Go + standalone). */
export function createPaymentAppLink(preparationId: string): string {
  return Linking.createURL(`/pay/r/${preparationId}`);
}

/** Public https link (copy / share branding). */
export function createPaymentHttpsLink(preparationId: string): string {
  return `https://pay.finora.app/r/${preparationId}`;
}

type Nav = {
  replace: (href: '/') => void;
};

/**
 * Navigate to chat and append a pay prompt for this payment request.
 * Amount comes from the in-app registry when the request was created here.
 */
export function startPaymentFromLink(
  preparationId: string,
  aui: ThreadSender,
  router: Nav | Router,
) {
  const https = createPaymentHttpsLink(preparationId);
  const parsed = parsePaymentQr(https) ?? parsePaymentQr(`finora://pay/r/${preparationId}`);
  if (!parsed) return;

  const amount = parsed.amount ?? 0;
  const prompt =
    amount > 0
      ? buildScanPayPrompt(parsed, amount)
      : `Pay payment request ${https}`;

  router.replace('/');
  setTimeout(() => {
    sendChatPrompt(aui, prompt);
  }, 120);
}
