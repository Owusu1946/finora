import type { ChatModelAdapter, ThreadMessage } from '@assistant-ui/react-native';

import type { BalanceWallet } from '@/components/chat/BalancesCard';
import type { ConversionQuote } from '@/components/chat/ConversionCard';
import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';
import type { ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';
import type { Invoice } from '@/components/invoices/types';
import { MOCK_INVOICES } from '@/components/invoices/types';
import type { RecurringFrequency } from '@/components/recurring/types';
import {
  contactToPaymentDestination,
  findContactsByName,
} from '@/lib/contact-lookup';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function lastUserText(messages: readonly ThreadMessage[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return (
    lastUser?.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
      .trim() ?? ''
  );
}

const SEND_RE =
  /\b(send|pay|transfer|payout)\b|\bsend money\b|\bpay\s+[a-z0-9]/i;
const RECEIVE_RE =
  /\b(receive|deposit|fund|top\s*up|add money|get paid|payment details|virtual account|wallet address)\b/i;
const BALANCE_RE =
  /\b(balance|balances|wallets|how much|what.?s in my|check my (money|account))\b/i;
const CONVERT_RE =
  /\b(convert|exchange|fx|swap|change)\b|\b(usd|ghs|eur|gbp|usdt|usdc)\s*(to|into)\s*(usd|ghs|eur|gbp|usdt|usdc)\b/i;
const INVOICE_RE =
  /\b(invoice|invoices|supplier(?:s)?|unpaid bill|bills? from|find (?:my )?bills)\b/i;
const RECURRING_RE =
  /\b(every\s+(week|month|quarter)|recurring|schedule|weekly|monthly|quarterly|auto(?:matic)?(?:ally)?\s+pay|standing\s+order|set\s*up\s+(my\s+)?(rent|payment|payout|salary)|rent\s+payment|setup\s+(a\s+)?(recurring|scheduled)|i want to (setup|set up|schedule))\b/i;

function isInvoiceIntent(prompt: string) {
  return INVOICE_RE.test(prompt);
}

function isRecurringIntent(prompt: string) {
  return RECURRING_RE.test(prompt);
}

function parseRecipientQuery(prompt: string): string | null {
  const patterns = [
    /\b(?:send(?:\s+money)?|pay|transfer|payout)\s+(?:money\s+)?(?:to\s+)?([A-Za-z][A-Za-z'-]{1,})/i,
    /\bto\s+([A-Za-z][A-Za-z'-]{1,})(?:\s+[A-Za-z][A-Za-z'-]{1,})?/i,
  ];
  for (const re of patterns) {
    const m = prompt.match(re);
    if (!m?.[1]) continue;
    const word = m[1];
    if (/^(money|me|my|the|a|an|from|via|with|using|invoice|bill|rent)$/i.test(word)) {
      continue;
    }
    // Prefer "First Last" if present after to/pay
    const full = prompt.match(
      new RegExp(`\\b(?:to|pay)\\s+(${word}(?:\\s+[A-Za-z][A-Za-z'-]+)?)`, 'i'),
    );
    return (full?.[1] ?? word).trim();
  }
  return null;
}

function parseSchedulePurpose(prompt: string): string | undefined {
  if (/\brent\b/i.test(prompt)) return 'Rent';
  if (/\bsalary|payroll|wage\b/i.test(prompt)) return 'Salary';
  if (/\bsupplier|vendor\b/i.test(prompt)) return 'Supplier';
  if (/\butilit/i.test(prompt)) return 'Utilities';
  return undefined;
}

function parseScheduleSeed(prompt: string) {
  const amount = parseAmount(prompt);
  const destination = parseDestination(prompt);
  const purpose = parseSchedulePurpose(prompt);
  const name =
    parseRecipientQuery(prompt) ??
    (purpose === 'Rent' ? undefined : undefined);

  return {
    purpose,
    amount: amount?.amount,
    currency: amount?.currency,
    recipientName: name && !/^(rent|salary|setup)$/i.test(name) ? name : undefined,
    frequency: /\bweek/i.test(prompt)
      ? ('weekly' as const)
      : /\bquarter/i.test(prompt)
        ? ('quarterly' as const)
        : /\bmonth/i.test(prompt)
          ? ('monthly' as const)
          : undefined,
    destinationKind: destination?.kind,
    destinationLabel: destination?.label,
    destinationValue: destination?.value,
    dayOfMonth: /\b(1st|first)\b/i.test(prompt)
      ? 1
      : /\b(15th|mid)\b/i.test(prompt)
        ? 15
        : undefined,
    timeOfDay: prompt.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0],
    reference: purpose ? `${purpose} · auto-pay` : undefined,
  };
}

function isSendIntent(prompt: string) {
  return (
    SEND_RE.test(prompt) &&
    !RECEIVE_RE.test(prompt) &&
    !CONVERT_RE.test(prompt) &&
    !isInvoiceIntent(prompt) &&
    !isRecurringIntent(prompt)
  );
}

function isReceiveIntent(prompt: string) {
  return RECEIVE_RE.test(prompt);
}

function isBalanceIntent(prompt: string) {
  return (
    BALANCE_RE.test(prompt) &&
    !isSendIntent(prompt) &&
    !isReceiveIntent(prompt) &&
    !isInvoiceIntent(prompt) &&
    !isRecurringIntent(prompt)
  );
}

function isConvertIntent(prompt: string) {
  return CONVERT_RE.test(prompt);
}

function parseAmount(prompt: string): { amount: number; currency: string } | null {
  const withCurrency =
    prompt.match(
      /(?:(?:ghs|usd|eur|gbp|usdt|usdc)\s*)?(\d+(?:\.\d{1,2})?)\s*(ghs|usd|eur|gbp|usdt|usdc)?/i,
    ) ?? null;
  if (!withCurrency) return null;
  const amount = Number(withCurrency[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const currency = (
    withCurrency[2] ??
    withCurrency[0].match(/ghs|usd|eur|gbp|usdt|usdc/i)?.[0] ??
    'GHS'
  ).toUpperCase();
  return { amount, currency };
}

function parseCurrencyHint(prompt: string): string | undefined {
  return prompt.match(/\b(ghs|usd|eur|gbp|usdt|usdc)\b/i)?.[1]?.toUpperCase();
}

function parsePrefer(
  prompt: string,
): 'virtual_account' | 'mobile_money' | 'crypto' | undefined {
  if (/\b(crypto|usdt|usdc|wallet address|trc|erc)\b/i.test(prompt)) return 'crypto';
  if (/\b(momo|mobile money|mtn|telecel)\b/i.test(prompt)) return 'mobile_money';
  if (/\b(iban|virtual account|bank|swift|fps|sepa)\b/i.test(prompt)) {
    return 'virtual_account';
  }
  return undefined;
}

function parseDestination(prompt: string): PaymentConfirmation['destination'] | null {
  const crypto = prompt.match(/\b(0x[a-fA-F0-9]{20,}|T[1-9A-HJ-NP-Za-km-z]{25,})\b/);
  if (crypto) {
    const value = crypto[1]!;
    return {
      kind: 'crypto_wallet',
      label: value.startsWith('0x') ? 'ETH wallet' : 'USDT · TRC-20',
      value,
    };
  }

  const iban = prompt.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/i);
  if (iban) {
    return {
      kind: 'bank_account',
      label: 'Bank account',
      value: iban[1]!.toUpperCase(),
    };
  }

  const phone = prompt.match(/\b(?:\+?233|0)?\s*([25]\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4})\b/);
  if (phone) {
    const digits = phone[0]!.replace(/\D/g, '');
    const normalized =
      digits.startsWith('233') && digits.length >= 12
        ? `+${digits}`
        : digits.startsWith('0')
          ? digits
          : `0${digits}`;
    const network = /^(024|054|055|059|025)/.test(normalized.replace('+233', '0'))
      ? 'MTN MoMo'
      : /^(020|050)/.test(normalized.replace('+233', '0'))
        ? 'Telecel MoMo'
        : 'Mobile money';
    return {
      kind: 'mobile_money',
      label: network,
      value: normalized,
    };
  }

  const account = prompt.match(/\b(?:acc(?:ount)?(?:\s*(?:no|number|#))?[:\s]*)(\d{8,14})\b/i);
  if (account) {
    return {
      kind: 'bank_account',
      label: 'Bank account',
      value: account[1]!,
    };
  }

  return null;
}

function mockRecipientName(destination: PaymentConfirmation['destination'], prompt: string) {
  const named = prompt.match(/\b(?:to|pay)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (named?.[1] && !/\d/.test(named[1])) return named[1];

  if (destination.kind === 'mobile_money') {
    if (destination.value.includes('055') || destination.value.includes('9182794')) {
      return 'Kwame Mensah';
    }
    return 'Mobile money recipient';
  }
  if (destination.kind === 'crypto_wallet') return 'Wallet recipient';
  return 'Account holder';
}

function buildMockPayment(prompt: string): PaymentConfirmation {
  const parsedAmount = parseAmount(prompt);
  const destination =
    parseDestination(prompt) ??
    ({
      kind: 'mobile_money' as const,
      label: 'MTN MoMo',
      value: '0559182794',
    } satisfies PaymentConfirmation['destination']);

  return {
    amount: parsedAmount?.amount ?? 100,
    currency: parsedAmount?.currency ?? 'GHS',
    recipientName: mockRecipientName(destination, prompt),
    destination,
    reference: 'Finora transfer',
  };
}

function buildMockReceiveMethods(): ReceiveMethod[] {
  return [
    {
      id: 'va-usd',
      kind: 'virtual_account',
      currency: 'USD',
      title: 'USD virtual account',
      subtitle: 'Receive via local ACH rails into your Finora wallet.',
      qrPayload: 'finora:va:usd:GB82CLRB04066800012345',
      fields: [
        { label: 'Account name', value: 'Finora / Kenneth Owusu' },
        { label: 'IBAN', value: 'GB82 CLRB 0406 6800 0123 45' },
        { label: 'BIC / SWIFT', value: 'CLRBGB22' },
        { label: 'Bank', value: 'ClearBank', copyable: false },
      ],
    },
    {
      id: 'momo-ghs',
      kind: 'mobile_money',
      currency: 'GHS',
      title: 'MTN MoMo collection',
      subtitle: 'Ask the sender to pay this MoMo number.',
      qrPayload: 'finora:momo:ghs:0550123456',
      fields: [
        { label: 'Network', value: 'MTN Mobile Money', copyable: false },
        { label: 'MoMo number', value: '0550123456' },
        { label: 'Account name', value: 'Kenneth Owusu' },
      ],
    },
    {
      id: 'crypto-usdt',
      kind: 'crypto',
      currency: 'USDT',
      title: 'USDT deposit address',
      subtitle: 'TRC-20 only — sending on another network may lose funds.',
      qrPayload: 'TXyzFinoraMockDepositAddress9hQ2',
      fields: [
        { label: 'Network', value: 'TRC-20 (Tron)', copyable: false },
        { label: 'Asset', value: 'USDT', copyable: false },
        { label: 'Address', value: 'TXyzFinoraMockDepositAddress9hQ2' },
      ],
    },
  ];
}

function buildMockBalances(): { wallets: BalanceWallet[]; totalUsd: number } {
  const wallets: BalanceWallet[] = [
    {
      id: 'w-usd',
      currency: 'USD',
      name: 'USD wallet',
      balance: 1240.5,
      usdEquivalent: 1240.5,
      symbol: '$',
    },
    {
      id: 'w-ghs',
      currency: 'GHS',
      name: 'GHS wallet',
      balance: 8450,
      usdEquivalent: 545.16,
      symbol: '₵',
    },
    {
      id: 'w-usdt',
      currency: 'USDT',
      name: 'USDT · TRC-20',
      balance: 320,
      usdEquivalent: 320,
      symbol: '$',
    },
  ];
  return {
    wallets,
    totalUsd: wallets.reduce((s, w) => s + w.usdEquivalent, 0),
  };
}

const MOCK_RATES: Record<string, number> = {
  'USD:GHS': 15.5,
  'GHS:USD': 1 / 15.5,
  'USD:EUR': 0.92,
  'EUR:USD': 1 / 0.92,
  'USD:GBP': 0.78,
  'GBP:USD': 1 / 0.78,
  'USD:USDT': 1,
  'USDT:USD': 1,
  'GHS:USDT': 1 / 15.5,
  'USDT:GHS': 15.5,
};

function buildMockDueInvoices(): Invoice[] {
  return MOCK_INVOICES.filter((i) => i.status === 'due');
}

function parseFrequency(prompt: string): RecurringFrequency {
  if (/\b(week|weekly)\b/i.test(prompt)) return 'weekly';
  if (/\b(quarter|quarterly)\b/i.test(prompt)) return 'quarterly';
  return 'monthly';
}

function buildMockRecurring(prompt: string) {
  const payment = buildMockPayment(prompt);
  const named =
    prompt.match(
      /\b(?:to|pay)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?(?:\s+Ltd)?)\b/,
    )?.[1] ?? payment.recipientName;

  // Prefer known suppliers when mentioned
  const lower = prompt.toLowerCase();
  let recipientName = named;
  let destination = payment.destination;
  let currency = payment.currency;
  let amount = payment.amount;

  if (lower.includes('techflow')) {
    recipientName = 'TechFlow Ltd';
    currency = payment.currency === 'GHS' && !parseAmount(prompt) ? 'GBP' : payment.currency;
    amount = parseAmount(prompt)?.amount ?? 780;
    destination = { kind: 'bank_account', label: 'FPS', value: '•••• 0194' };
  } else if (lower.includes('clearview')) {
    recipientName = 'ClearView Partners';
    amount = parseAmount(prompt)?.amount ?? 1500;
    currency = 'GBP';
    destination = { kind: 'bank_account', label: 'SWIFT', value: 'BARCGB22' };
  }

  return {
    amount,
    currency,
    recipientName,
    frequency: parseFrequency(prompt),
    destinationKind: destination.kind,
    destinationLabel: destination.label,
    destinationValue: destination.value,
    reference: 'Recurring supplier payment',
  };
}

function buildMockConversion(prompt: string): ConversionQuote {
  const pair =
    prompt.match(/\b(usd|ghs|eur|gbp|usdt|usdc)\s*(?:to|into|->)\s*(usd|ghs|eur|gbp|usdt|usdc)\b/i) ??
    null;
  const fromCurrency = (pair?.[1] ?? 'USD').toUpperCase();
  const toCurrency = (pair?.[2] ?? 'GHS').toUpperCase();
  const amountMatch = prompt.match(/\b(\d+(?:\.\d{1,2})?)\b/);
  const fromAmount = amountMatch ? Number(amountMatch[1]) : 100;
  const rate = MOCK_RATES[`${fromCurrency}:${toCurrency}`] ?? 1;
  const fee = Number((fromAmount * 0.004).toFixed(2));
  const toAmount = Number(((fromAmount - fee) * rate).toFixed(2));
  return {
    fromCurrency,
    toCurrency,
    fromAmount,
    toAmount,
    rate,
    fee,
    feeCurrency: fromCurrency,
  };
}

/** Local mock model — streams reasoning + tool calls so CoT UI is visible. */
export const finoraChatAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const prompt = lastUserText(messages);

    if (isInvoiceIntent(prompt)) {
      const invoices = buildMockDueInvoices();
      const args = { source: 'gmail' as const, status: 'due' as const };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Supplier invoices requested.\nChecking Gmail connection and unpaid bills…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_invoices',
            toolName: 'list_invoices',
            args,
            argsText,
          },
        ],
      };

      await wait(600);
      if (abortSignal.aborted) return;

      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${invoices.length} unpaid invoice(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_invoices',
            toolName: 'list_invoices',
            args,
            argsText,
            result: { invoices },
          },
          {
            type: 'text',
            text:
              invoices.length > 0
                ? `Found ${invoices.length} unpaid supplier invoice${invoices.length === 1 ? '' : 's'} from Gmail. Pay any with your passcode, or open Invoices in the drawer.`
                : 'No unpaid invoices right now. Connect Gmail under Integrations if you haven’t.',
          },
        ],
      };
      return;
    }

    if (isRecurringIntent(prompt)) {
      const seed = parseScheduleSeed(prompt);
      const args = { ...seed };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Scheduled / recurring payment requested.\nOpening setup wizard for amount, destination, and auto-pay time…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_schedule_payment_wizard',
            toolName: 'schedule_payment_wizard',
            args,
            argsText,
          },
        ],
      };

      await wait(450);
      if (abortSignal.aborted) return;

      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nWizard ready — I’ll ask only for what’s missing.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_schedule_payment_wizard',
            toolName: 'schedule_payment_wizard',
            args,
            argsText,
          },
          {
            type: 'text',
            text: seed.purpose
              ? `Let’s set up your ${seed.purpose.toLowerCase()} auto-pay. Tap through the steps — amount, where it goes, and when Finora should pay.`
              : 'Let’s set up an automatic payment. I’ll walk you through amount, recipient, rail, and the exact time it should fire.',
          },
        ],
      };
      return;
    }

    if (isReceiveIntent(prompt)) {
      const methods = buildMockReceiveMethods();
      const currency = parseCurrencyHint(prompt);
      const prefer = parsePrefer(prompt);
      const args = { currency, prefer };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Receive request detected.\nLoading virtual accounts, MoMo collection, and crypto deposit addresses…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_receive_methods',
            toolName: 'list_receive_methods',
            args,
            argsText,
          },
        ],
      };

      await wait(550);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: `${reasoning}\nMethods ready.` },
          {
            type: 'tool-call',
            toolCallId: 'call_list_receive_methods',
            toolName: 'list_receive_methods',
            args,
            argsText,
            result: { methods },
          },
          {
            type: 'text',
            text: 'Here are your receive options — switch between bank VA, MoMo, and crypto, then copy or share.',
          },
        ],
      };
      return;
    }

    if (isSendIntent(prompt)) {
      const queryName = parseRecipientQuery(prompt);
      const parsedAmount = parseAmount(prompt);
      const explicitDestination = parseDestination(prompt);

      // Contact-aware path when user names someone (and didn't paste an address/phone)
      if (queryName && !explicitDestination) {
        const matches = await findContactsByName(queryName);
        if (matches.length > 0) {
          // Exact single match with amount → classic confirm card
          if (matches.length === 1 && parsedAmount) {
            const contact = matches[0]!;
            const dest = contactToPaymentDestination(contact);
            const args = {
              amount: parsedAmount.amount,
              currency: parsedAmount.currency || contact.currency,
              recipientName: contact.name,
              destinationKind: dest.kind,
              destinationLabel: dest.label,
              destinationValue: dest.value,
              reference: `To ${contact.name}`,
            };
            const argsText = JSON.stringify(args);
            const reasoning = `Found ${contact.name} in contacts.\nPreparing confirmation…`;

            yield { content: [{ type: 'reasoning', text: reasoning }] };
            await wait(400);
            if (abortSignal.aborted) return;

            yield {
              content: [
                { type: 'reasoning', text: `${reasoning}\nReady.` },
                {
                  type: 'tool-call',
                  toolCallId: 'call_prepare_payment',
                  toolName: 'prepare_payment',
                  args,
                  argsText,
                },
                {
                  type: 'text',
                  text: `Found ${contact.name} (${contact.method}). Confirm sending ${args.currency} ${args.amount.toLocaleString()}.`,
                },
              ],
            };
            return;
          }

          // Multiple matches and/or missing amount → resolve_send wizard
          const candidates = matches.map((c) => ({
            id: c.id,
            name: c.name,
            initials: c.initials,
            currency: c.currency,
            method: c.method,
            identifier: c.identifier,
          }));
          const args = {
            queryName,
            amount: parsedAmount?.amount,
            currency: parsedAmount?.currency,
            candidates,
          };
          const argsText = JSON.stringify(args);
          const reasoning =
            matches.length > 1
              ? `Several contacts match “${queryName}”.\nAsking you to pick the right one…`
              : `Found ${matches[0]!.name} in contacts.\nNeed the amount before confirming…`;

          yield { content: [{ type: 'reasoning', text: reasoning }] };
          await wait(400);
          if (abortSignal.aborted) return;

          yield {
            content: [
              { type: 'reasoning', text: reasoning },
              {
                type: 'tool-call',
                toolCallId: 'call_resolve_send',
                toolName: 'resolve_send',
                args,
                argsText,
              },
            ],
          };

          await wait(400);
          if (abortSignal.aborted) return;

          yield {
            content: [
              { type: 'reasoning', text: `${reasoning}\nReady.` },
              {
                type: 'tool-call',
                toolCallId: 'call_resolve_send',
                toolName: 'resolve_send',
                args,
                argsText,
              },
              {
                type: 'text',
                text:
                  matches.length > 1
                    ? `I found ${matches.length} people named like “${queryName}”. Pick who to pay${parsedAmount ? '' : ', then choose an amount'}.`
                    : `Paying ${matches[0]!.name} — how much should I send?`,
              },
            ],
          };
          return;
        }
      }

      const payment = buildMockPayment(prompt);
      const reasoning = `Payment request detected.\nLooking up recipient and preparing confirmation…`;
      const args = {
        amount: payment.amount,
        currency: payment.currency,
        recipientName: payment.recipientName,
        destinationKind: payment.destination.kind,
        destinationLabel: payment.destination.label,
        destinationValue: payment.destination.value,
        reference: payment.reference,
      };
      const argsText = JSON.stringify(args);

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(450);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_payment',
            toolName: 'prepare_payment',
            args,
            argsText,
          },
        ],
      };

      await wait(500);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: `${reasoning}\nRecipient matched.` },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_payment',
            toolName: 'prepare_payment',
            args,
            argsText,
          },
          {
            type: 'text',
            text: `Confirm sending ${payment.currency} ${payment.amount.toLocaleString()} to ${payment.recipientName} (${payment.destination.value}).`,
          },
        ],
      };
      return;
    }

    if (isConvertIntent(prompt)) {
      const quote = buildMockConversion(prompt);
      const args = { ...quote };
      const argsText = JSON.stringify(args);
      const reasoning =
        'FX conversion requested.\nFetching live rate preview and preparing confirmation…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_conversion',
            toolName: 'prepare_conversion',
            args,
            argsText,
          },
        ],
      };

      await wait(500);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: `${reasoning}\nRate locked for preview.` },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_conversion',
            toolName: 'prepare_conversion',
            args,
            argsText,
          },
          {
            type: 'text',
            text: `Convert ${quote.fromAmount} ${quote.fromCurrency} to about ${quote.toAmount} ${quote.toCurrency} at ${quote.rate.toFixed(4)}. Confirm with your passcode to execute.`,
          },
        ],
      };
      return;
    }

    if (isBalanceIntent(prompt) || !isSendIntent(prompt)) {
      const balances = buildMockBalances();
      const args = {};
      const argsText = '{}';
      const reasoning = isBalanceIntent(prompt)
        ? 'Balance check requested.\nLoading wallet balances…'
        : `Understanding: "${prompt.slice(0, 80)}${
            prompt.length > 80 ? '…' : ''
          }"\nChecking account context and available wallets…`;

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(450);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_get_balances',
            toolName: 'get_balances',
            args,
            argsText,
          },
        ],
      };

      await wait(550);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: `${reasoning}\nBalances ready.` },
          {
            type: 'tool-call',
            toolCallId: 'call_get_balances',
            toolName: 'get_balances',
            args,
            argsText,
            result: balances,
          },
          {
            type: 'text',
            text: isBalanceIntent(prompt)
              ? 'Here are your wallet balances. Receive or send from any wallet, or try “Convert 100 USD to GHS”.'
              : 'Here are your wallets to get started. Try send, receive, or convert from chat.',
          },
        ],
      };
    }
  },
};
