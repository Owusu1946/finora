import type { PaymentDestinationKind } from '@/components/chat/PaymentConfirmationCard';
import { getPaymentRequest } from '@/lib/payment-request-registry';

export type PaymentQrDestination = {
  kind: PaymentDestinationKind;
  label: string;
  value: string;
};

export type ParsedPaymentQr = {
  /** Raw payload that was parsed. */
  raw: string;
  currency: string;
  destination: PaymentQrDestination;
  amount?: number;
  reference?: string;
  preparationId?: string;
  /** True when amount must be collected before pay. */
  needsAmount: boolean;
};

const FINORA_MOMO = /^finora:momo:([a-z0-9]+):(.+)$/i;
const FINORA_VA = /^finora:va:([a-z0-9]+):(.+)$/i;
const PAY_LINK =
  /(?:https?:\/\/)?(?:www\.)?pay\.finora\.app\/r\/([A-Za-z0-9_-]+)|(?:finora:\/\/pay\/r\/|\/pay\/r\/)([A-Za-z0-9_-]+)/i;
const CRYPTO = /\b(0x[a-fA-F0-9]{20,}|T[1-9A-HJ-NP-Za-km-z]{25,})\b/;

function momoLabel(phone: string): string {
  const normalized = phone.replace(/\s/g, '');
  const local = normalized.replace(/^\+?233/, '0');
  if (/^(024|054|055|059|025)/.test(local)) return 'MTN MoMo';
  if (/^(020|050)/.test(local)) return 'Telecel MoMo';
  return 'Mobile money';
}

/**
 * Parse a Finora receive QR, crypto address, or payment-request link.
 * Looks up registered payment requests for pay.finora.app/r/{id}.
 */
export function parsePaymentQr(input: string): ParsedPaymentQr | null {
  const raw = input.trim();
  if (!raw) return null;

  const payMatch = raw.match(PAY_LINK);
  if (payMatch) {
    const preparationId = (payMatch[1] || payMatch[2])!;
    const registered = getPaymentRequest(preparationId);
    if (registered) {
      return {
        raw: registered.link,
        currency: registered.currency,
        amount: registered.amount,
        reference: registered.memo ?? `Payment request ${preparationId}`,
        preparationId,
        needsAmount: false,
        destination: {
          kind: 'bank_account',
          label: 'Finora payment request',
          value: registered.link,
        },
      };
    }
    // Unknown link — still treat as payable request; amount required.
    return {
      raw: `https://pay.finora.app/r/${preparationId}`,
      currency: 'GHS',
      preparationId,
      reference: `Payment request ${preparationId}`,
      needsAmount: true,
      destination: {
        kind: 'bank_account',
        label: 'Finora payment request',
        value: `https://pay.finora.app/r/${preparationId}`,
      },
    };
  }

  const momo = raw.match(FINORA_MOMO);
  if (momo) {
    const currency = momo[1]!.toUpperCase();
    const phone = momo[2]!.trim();
    return {
      raw: `finora:momo:${currency.toLowerCase()}:${phone}`,
      currency,
      needsAmount: true,
      destination: {
        kind: 'mobile_money',
        label: momoLabel(phone),
        value: phone,
      },
    };
  }

  const va = raw.match(FINORA_VA);
  if (va) {
    const currency = va[1]!.toUpperCase();
    const iban = va[2]!.trim().replace(/\s+/g, '').toUpperCase();
    return {
      raw: `finora:va:${currency.toLowerCase()}:${iban}`,
      currency,
      needsAmount: true,
      destination: {
        kind: 'bank_account',
        label: `${currency} virtual account`,
        value: iban,
      },
    };
  }

  const crypto = raw.match(CRYPTO);
  if (crypto) {
    const value = crypto[1]!;
    return {
      raw: value,
      currency: value.startsWith('0x') ? 'USDT' : 'USDT',
      needsAmount: true,
      destination: {
        kind: 'crypto_wallet',
        label: value.startsWith('0x') ? 'ETH wallet' : 'USDT · TRC-20',
        value,
      },
    };
  }

  return null;
}

/** Build a chat prompt the mock adapter maps to prepare_payment. */
export function buildScanPayPrompt(parsed: ParsedPaymentQr, amount: number): string {
  const ccy = parsed.currency;
  if (parsed.preparationId) {
    return `Pay payment request ${parsed.destination.value} amount ${amount} ${ccy}`;
  }
  if (parsed.raw.startsWith('finora:')) {
    return `Pay ${amount} ${ccy} to ${parsed.raw}`;
  }
  return `Pay ${amount} ${ccy} to ${parsed.destination.value}`;
}

export function mockRecipientNameForQr(parsed: ParsedPaymentQr): string {
  if (parsed.preparationId) return 'Payment request';
  const { destination } = parsed;
  if (destination.kind === 'mobile_money') {
    if (destination.value.includes('055') || destination.value.includes('9182794')) {
      return 'Kwame Mensah';
    }
    return 'Mobile money recipient';
  }
  if (destination.kind === 'crypto_wallet') return 'Wallet recipient';
  if (destination.kind === 'bank_account') return 'Account holder';
  return 'Recipient';
}
