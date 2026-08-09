import type { ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';

/** How the user chooses to put money into Finora (WeWire-shaped). */
export type FundingSource = 'bank' | 'mobile_money' | 'crypto' | 'momo_pull';

export type FundingMethod = ReceiveMethod & {
  /** Maps UI source → catalog entry */
  source: Exclude<FundingSource, 'momo_pull'>;
};

export const FUNDING_SOURCE_COPY: Record<
  FundingSource,
  { label: string; blurb: string; eta?: string; fee?: string }
> = {
  bank: {
    label: 'Bank transfer',
    blurb: 'Send from your bank to a Finora virtual account',
    eta: 'Instant',
    fee: 'Free',
  },
  mobile_money: {
    label: 'Mobile money',
    blurb: 'Pay into your MoMo collection number',
    eta: 'Instant',
  },
  momo_pull: {
    label: 'Charge my MoMo',
    blurb: 'Approve a prompt on your phone — we pull the amount',
    eta: 'Instant',
  },
  crypto: {
    label: 'Stablecoin wallet',
    blurb: 'Receive USDT or USDC on your chosen network',
    eta: '1 - 2 mins',
  },
};

/** Single catalog for chat fund wizard, receive card, and wallets deposit. */
export function listFundingMethods(): FundingMethod[] {
  return [
    {
      id: 'va-usd',
      source: 'bank',
      kind: 'virtual_account',
      currency: 'USD',
      title: 'USD account',
      subtitle: 'ACH / wire into your Finora USD wallet',
      qrPayload: 'finora:va:usd:GB82CLRB04066800012345',
      fields: [
        { label: 'Account name', value: 'Finora / Kenneth Owusu' },
        { label: 'IBAN', value: 'GB82 CLRB 0406 6800 0123 45' },
        { label: 'BIC / SWIFT', value: 'CLRBGB22' },
        { label: 'Bank', value: 'ClearBank', copyable: false },
      ],
    },
    {
      id: 'va-eur',
      source: 'bank',
      kind: 'virtual_account',
      currency: 'EUR',
      title: 'EUR account',
      subtitle: 'SEPA into your Finora EUR wallet',
      qrPayload: 'finora:va:eur:DE89370400440532013000',
      fields: [
        { label: 'Account name', value: 'Finora / Kenneth Owusu' },
        { label: 'IBAN', value: 'DE89 3704 0044 0532 0130 00' },
        { label: 'BIC / SWIFT', value: 'COBADEFFXXX' },
        { label: 'Bank', value: 'Commerzbank', copyable: false },
      ],
    },
    {
      id: 'va-gbp',
      source: 'bank',
      kind: 'virtual_account',
      currency: 'GBP',
      title: 'GBP account',
      subtitle: 'Faster Payments into your Finora GBP wallet',
      qrPayload: 'finora:va:gbp:GB29NWBK60161331926819',
      fields: [
        { label: 'Account name', value: 'Finora / Kenneth Owusu' },
        { label: 'Sort code', value: '60-16-13' },
        { label: 'Account number', value: '31926819' },
        { label: 'Bank', value: 'NatWest', copyable: false },
      ],
    },
    {
      id: 'momo-ghs',
      source: 'mobile_money',
      kind: 'mobile_money',
      currency: 'GHS',
      title: 'MTN MoMo',
      subtitle: 'Ask anyone to pay this number — lands in GHS',
      qrPayload: 'finora:momo:ghs:0550123456',
      fields: [
        { label: 'Network', value: 'MTN Mobile Money', copyable: false },
        { label: 'MoMo number', value: '0550123456' },
        { label: 'Account name', value: 'Kenneth Owusu' },
      ],
    },
    {
      id: 'crypto-usdt',
      source: 'crypto',
      kind: 'crypto',
      currency: 'USDT',
      title: 'USDT · TRC-20',
      subtitle: 'TRON only — other networks may lose funds',
      qrPayload: 'TXyzFinoraMockDepositAddress9hQ2',
      fields: [
        { label: 'Network', value: 'TRON (TRC-20)', copyable: false },
        { label: 'Asset', value: 'USDT', copyable: false },
        { label: 'Address', value: 'TXyzFinoraMockDepositAddress9hQ2' },
      ],
    },
    {
      id: 'crypto-usdc',
      source: 'crypto',
      kind: 'crypto',
      currency: 'USDC',
      title: 'USDC · BASE',
      subtitle: 'BASE only — other networks may lose funds',
      qrPayload: '0x6BeA76b3159d78A9bf74Be1Ba5d970eBF7fc0a9b',
      fields: [
        { label: 'Network', value: 'BASE', copyable: false },
        { label: 'Asset', value: 'USDC', copyable: false },
        { label: 'Address', value: '0x6BeA76b3159d78A9bf74Be1Ba5d970eBF7fc0a9b' },
      ],
    },
  ];
}

export function methodsForSource(source: FundingSource): FundingMethod[] {
  if (source === 'momo_pull') {
    return listFundingMethods().filter((m) => m.source === 'mobile_money');
  }
  return listFundingMethods().filter((m) => m.source === source);
}

export function pickMethod(opts: {
  source?: FundingSource;
  currency?: string;
  methodId?: string;
}): FundingMethod | undefined {
  const all = listFundingMethods();
  if (opts.methodId) return all.find((m) => m.id === opts.methodId);
  const pool = opts.source ? methodsForSource(opts.source) : all;
  if (opts.currency) {
    const hit = pool.find(
      (m) => m.currency.toUpperCase() === opts.currency!.toUpperCase(),
    );
    if (hit) return hit;
  }
  return pool[0];
}

export function inferFundingSource(prompt: string): FundingSource | undefined {
  if (/\b(momo\s*pull|charge\s+(my\s+)?(momo|phone)|ussd|prompt)\b/i.test(prompt)) {
    return 'momo_pull';
  }
  if (/\b(crypto|usdt|usdc|trc|on-?chain)\b/i.test(prompt)) return 'crypto';
  if (/\b(momo|mobile money|mtn|telecel)\b/i.test(prompt)) return 'mobile_money';
  if (/\b(bank|sepa|ach|wire|iban|fps|transfer)\b/i.test(prompt)) return 'bank';
  return undefined;
}
