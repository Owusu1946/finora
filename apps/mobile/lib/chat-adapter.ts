import type {
  ChatModelAdapter,
  ChatModelRunResult,
  ThreadMessage,
  ToolCallMessagePart,
} from '@assistant-ui/react-native';

import type { BalanceWallet } from '@/components/chat/BalancesCard';
import type { ConversionQuote } from '@/components/chat/ConversionCard';
import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';
import type { ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';
import type { Invoice } from '@/components/invoices/types';

import { MOCK_BUSINESS_PLAN } from '@/components/approvals/types';
import { MOCK_INVOICES } from '@/components/invoices/types';
import { isBusinessAccount } from '@/lib/account';
import { listAutomations } from '@/lib/automations-storage';
import { listBeneficiaries } from '@/lib/beneficiaries-storage';
import { getCalendarEvents } from '@/lib/calendar-integration-api';
import {
  contactToPaymentDestination,
  contactToSendSeed,
  findContactsByName,
} from '@/lib/contact-lookup';
import { listContacts } from '@/lib/contacts-storage';
import { createEmployee, defaultPayrollPeriod, listActiveEmployees } from '@/lib/employees-storage';
import { listExpenses } from '@/lib/expenses-storage';
import { CURRENT_FINORA_ACCOUNT, getCurrentFinoraTag, lookupFinoraTag } from '@/lib/finora-tags';
import { inferFundingSource, listFundingMethods } from '@/lib/funding-methods';
import { getIntegrations } from '@/lib/integrations-storage';
import { mockRecipientNameForQr, parsePaymentQr, type ParsedPaymentQr } from '@/lib/payment-qr';
import { listPolicies, simulatePolicy } from '@/lib/policies-storage';
import { listOpenSmsPaymentRequests } from '@/lib/sms-requests-storage';
import { listSuppliers } from '@/lib/suppliers-storage';
import { getTreasuryOverview } from '@/lib/treasury';
import {
  findVirtualCardByLabel,
  getVirtualCard,
  listVirtualCards,
  setVirtualCardStatus,
} from '@/lib/virtual-cards-storage';

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
  /\b(send|pay|transfer|payout|envoyer|payer|transférer|virement)\b|\bsend money\b|\bpay\s+[a-z0-9]/i;
const FUND_RE =
  /\b(deposit|fund|top\s*up|add money|add funds|load (?:my )?(?:wallet|account)|charge my momo|déposer|recharger)\b/i;
const RECEIVE_RE =
  /\b(receive|get paid|payment details|virtual account|wallet address|how (?:do|can) i (?:receive|get paid)|recevoir|rib|iban)\b/i;
const PAYMENT_REQUEST_RE =
  /\b(payment\s+link|payment\s+request|create\s+(?:a\s+)?(?:payment\s+)?(?:link|request)|request\s+(?:\d+|money|payment|ghs|usd|eur|gbp|usdt)|ask\s+(?:for\s+)?(?:\d+|money|payment)|pay\s+me|send\s+me\s+(?:money|\d+)|invoice\s+me|lien\s+de\s+paiement|demander\s+un\s+paiement)\b/i;
const BALANCE_RE =
  /\b(balance|balances|wallets|how much|what.?s in my|check my (money|account)|solde|soldes|portefeuilles?|compte)\b/i;
const CONVERT_RE =
  /\b(convert|exchange|fx|swap|change|convertir|échanger|taux)\b|\b(usd|ghs|eur|gbp|usdt|usdc)\s*(to|into|en)\s*(usd|ghs|eur|gbp|usdt|usdc)\b/i;
const INVOICE_RE =
  /\b(invoice|invoices|unpaid bill|bills? from|find (?:my )?bills|supplier invoices?|unpaid invoices?|facture|factures)\b/i;
const CALENDAR_DUES_RE =
  /\b(calendar|what.?s due|due on my calendar|money events?|rent (?:and|&) payroll|payroll (?:and|&) rent|due this week|upcoming (?:dues?|bills?|payments?)|calendrier|échéances?)\b/i;
const SMS_REQUESTS_RE =
  /\b(sms|text message|momo (?:sms|prompt)|payment requests? from (?:my )?(?:sms|texts?)|requests? from (?:my )?sms)\b/i;
const RECURRING_RE =
  /\b(every\s+(week|month|quarter)|recurring|schedule|weekly|monthly|quarterly|auto(?:matic)?(?:ally)?\s+pay|standing\s+order|set\s*up\s+(my\s+)?(rent|payment|payout|salary)|rent\s+payment|setup\s+(a\s+)?(recurring|scheduled)|i want to (setup|set up|schedule)|récurrent|mensuel|hebdomadaire)\b/i;
const FINANCIAL_PLAN_RE =
  /\bpay\s+everyone\b|\bpay\s+everything\s+due\b|\beverything\s+due\s+today\b|\bpay\s+all\s+(due|bills|invoices|suppliers)\b|\bfinancial\s+plan\b|\brun\s+(payroll\s+and|all)\b|\bplan\s+financier\b/i;
const PAYROLL_RE =
  /\b(run\s+payroll|pay\s+(?:the\s+)?(?:team|staff|employees?)|payroll\s+run|prepare\s+payroll|paie|salaires?|payer\s+l.?équipe)\b/i;
const LIST_EMPLOYEES_RE =
  /\b(show|list|my|view)\b.{0,20}\b(employees?|team|roster)\b|\b(team roster|employees?|employés?|salariés?)\b/i;
const LIST_SUPPLIERS_RE =
  /\b(show|list|my|view)\b.{0,16}\bsuppliers?\b|\bsuppliers?\s+directory\b|\bfournisseurs?\b/i;
const CREATE_EMPLOYEE_RE =
  /\b(add|create|hire)\s+(?:an?\s+)?employee\b|\bajouter\s+un\s+employé\b/i;
const LIST_BENEFICIARIES_RE =
  /\b(show|list|my|view)\b.{0,16}\bbeneficiar(?:y|ies)\b|\bbeneficiar(?:y|ies)\b|\bbénéficiaires?\b/i;
const LIST_POLICIES_RE =
  /\b(show|list|my|view)\b.{0,20}\b(approval\s+)?polic(?:y|ies)\b|\bwhat happens if i (?:send|pay)\b|\bsimulate\s+polic|\brègles?\b/i;
const LIST_AUTOMATIONS_RE = /\b(show|list|my|view)\b.{0,16}\bautomations?\b|\bautomations?\b/i;
const LIST_EXPENSES_RE =
  /\b(show|list|my|view)\b.{0,24}\b(business\s+)?expenses?\b|\bbusiness expenses?\b|\bdépenses?\b/i;
const TREASURY_RE = /\b(treasury|cash position|operating balance|treasury overview|trésorerie)\b/i;
const VIRTUAL_ACCOUNTS_RE =
  /\b(show|list|my|view)\b.{0,20}\bvirtual accounts?\b|\bvirtual accounts?\b|\bcomptes?\s+virtuels?\b/i;
const FINANCIAL_REPORT_RE =
  /\b(financial (report|insights?|summary)|cash flow|spending (summary|report)|business report|rapport|flux\s+de\s+trésorerie)\b/i;
const CREATE_CARD_RE =
  /\b(create|issue|make|new)\b.{0,24}\b(virtual\s+)?card\b|\bvirtual\s+card\s+for\b|\bcard\s+for\s+(netflix|meta|aws|travel)\b|\bcréer\s+une\s+carte\b/i;
const LIST_CARDS_RE =
  /\b(show|list|my|view)\b.{0,16}\b(virtual\s+)?cards?\b|\bvirtual\s+cards?\b|\bcartes?\b/i;
const MANAGE_CARD_RE =
  /\b(freeze|unfreeze|cancel)\b.{0,24}\bcard\b|\bcard\b.{0,24}\b(freeze|unfreeze|cancel|details|limit)\b|\bbloquer|débloquer\b/i;

function isFinancialPlanIntent(prompt: string) {
  return FINANCIAL_PLAN_RE.test(prompt);
}

function isCreateCardIntent(prompt: string) {
  return CREATE_CARD_RE.test(prompt);
}

function isListCardsIntent(prompt: string) {
  return LIST_CARDS_RE.test(prompt) && !isCreateCardIntent(prompt) && !isManageCardIntent(prompt);
}

function isManageCardIntent(prompt: string) {
  return MANAGE_CARD_RE.test(prompt);
}

function parseCardSeed(prompt: string) {
  const lower = prompt.toLowerCase();
  let label: string | undefined;
  if (lower.includes('netflix')) label = 'Netflix';
  else if (lower.includes('meta')) label = 'Meta ads';
  else if (lower.includes('aws')) label = 'AWS';
  else if (lower.includes('travel')) label = 'Travel';
  else {
    const forMatch = prompt.match(
      /\b(?:card|virtual card)\s+for\s+([A-Za-z][A-Za-z0-9 &-]{1,40})/i,
    );
    if (forMatch?.[1]) label = forMatch[1].trim();
  }

  // WeWire markets virtual cards as USD cards. Do not reinterpret a limit
  // explicitly stated in another currency as the same numeric USD amount.
  const unsupportedCurrency = /\b(?:GHS|EUR)\b|€/i.test(prompt);
  const amountMatch = unsupportedCurrency
    ? null
    : prompt.match(/(?:\$|USD)?\s*(\d+(?:\.\d{1,2})?)\s*(?:USD)?(?:\s*limit)?/i);
  const spendLimit = amountMatch ? Number(amountMatch[1]) : undefined;

  return {
    label,
    spendLimit: Number.isFinite(spendLimit) ? spendLimit : undefined,
  };
}

async function resolveManagedCard(prompt: string) {
  const idMatch = prompt.match(/\bcard_([a-z0-9]+)\b/i);
  if (idMatch) {
    return getVirtualCard(`card_${idMatch[1]}`);
  }
  const forMatch = prompt.match(
    /\b(?:freeze|unfreeze|cancel|show|open)\s+(?:my\s+)?([A-Za-z][A-Za-z0-9 &-]{1,40}?)\s+card\b/i,
  );
  if (forMatch?.[1]) {
    return findVirtualCardByLabel(forMatch[1]);
  }
  const ofMatch = prompt.match(/\bcard\s+for\s+([A-Za-z][A-Za-z0-9 &-]{1,40})/i);
  if (ofMatch?.[1]) {
    return findVirtualCardByLabel(ofMatch[1]);
  }
  const cards = await listVirtualCards();
  return cards.find((c) => c.status !== 'cancelled') ?? cards[0] ?? null;
}

function isInvoiceIntent(prompt: string) {
  return (
    INVOICE_RE.test(prompt) &&
    !isFinancialPlanIntent(prompt) &&
    !isCalendarDuesIntent(prompt) &&
    !isListSuppliersIntent(prompt) &&
    !isPayrollIntent(prompt)
  );
}

function isCalendarDuesIntent(prompt: string) {
  return (
    CALENDAR_DUES_RE.test(prompt) && !isFinancialPlanIntent(prompt) && !isPayrollIntent(prompt)
  );
}

function isSmsRequestsIntent(prompt: string) {
  return SMS_REQUESTS_RE.test(prompt);
}

function isPayrollIntent(prompt: string) {
  return PAYROLL_RE.test(prompt) && !isFinancialPlanIntent(prompt);
}

function isListEmployeesIntent(prompt: string) {
  return (
    LIST_EMPLOYEES_RE.test(prompt) && !isPayrollIntent(prompt) && !isCreateEmployeeIntent(prompt)
  );
}

function isListSuppliersIntent(prompt: string) {
  return LIST_SUPPLIERS_RE.test(prompt);
}

function isCreateEmployeeIntent(prompt: string) {
  return CREATE_EMPLOYEE_RE.test(prompt);
}

function isListBeneficiariesIntent(prompt: string) {
  return LIST_BENEFICIARIES_RE.test(prompt);
}

function isListPoliciesIntent(prompt: string) {
  return LIST_POLICIES_RE.test(prompt);
}

function isListAutomationsIntent(prompt: string) {
  return LIST_AUTOMATIONS_RE.test(prompt);
}

function isListExpensesIntent(prompt: string) {
  return LIST_EXPENSES_RE.test(prompt);
}

function isTreasuryIntent(prompt: string) {
  return TREASURY_RE.test(prompt);
}

function isVirtualAccountsIntent(prompt: string) {
  return VIRTUAL_ACCOUNTS_RE.test(prompt) && !isReceiveIntent(prompt);
}

function isFinancialReportIntent(prompt: string) {
  return FINANCIAL_REPORT_RE.test(prompt);
}

function isRecurringIntent(prompt: string) {
  return RECURRING_RE.test(prompt) && !isCalendarDuesIntent(prompt) && !isPayrollIntent(prompt);
}

function isBusinessFeatureIntent(prompt: string) {
  return (
    isPayrollIntent(prompt) ||
    isListEmployeesIntent(prompt) ||
    isListSuppliersIntent(prompt) ||
    isCreateEmployeeIntent(prompt) ||
    isListBeneficiariesIntent(prompt) ||
    isListPoliciesIntent(prompt) ||
    isListAutomationsIntent(prompt) ||
    isListExpensesIntent(prompt) ||
    isTreasuryIntent(prompt) ||
    isFinancialReportIntent(prompt)
  );
}

function businessOnlyMessage() {
  return 'Payroll, suppliers, and team tools are available on Business accounts. Switch account type in Settings to try the demo.';
}

function parseCreateEmployeeSeed(prompt: string) {
  const after = prompt.match(/\b(?:add|create|hire)\s+(?:an?\s+)?employee\s+(.+)$/i)?.[1]?.trim();
  if (!after) return null;
  const amount = parseAmount(after);
  const currency = amount?.currency ?? parseCurrencyHint(after) ?? 'USD';
  const salary = amount?.amount;
  const cleaned = after
    .replace(/(?:\$|£|€)?\s*\d+(?:\.\d{1,2})?\s*(?:ghs|usd|eur|gbp)?/i, '')
    .replace(/\b(ghs|usd|eur|gbp)\b/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const roleHints = ['designer', 'engineer', 'ops', 'finance', 'sales', 'manager'];
  const roleIdx = parts.findIndex((p) => roleHints.includes(p.toLowerCase()));
  const role =
    roleIdx >= 0
      ? parts[roleIdx]!.replace(/^\w/, (c) => c.toUpperCase())
      : parts.length > 2
        ? parts.slice(2).join(' ')
        : 'Team member';
  const name =
    roleIdx >= 0
      ? parts.slice(0, roleIdx).join(' ')
      : parts.slice(0, Math.min(2, parts.length)).join(' ');
  if (!name) return null;
  return {
    name,
    role,
    salary: salary && Number.isFinite(salary) ? salary : 2000,
    currency,
  };
}

function filterEventsByRange(
  events: Awaited<ReturnType<typeof getCalendarEvents>>,
  range: 'week' | 'month',
) {
  const horizonMs = (range === 'month' ? 31 : 7) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const filtered = events.filter((event) => {
    const due = new Date(event.dueAt).getTime();
    return due >= now - 12 * 60 * 60 * 1000 && due <= now + horizonMs;
  });
  console.info('[Calendar] chat range filter', {
    range,
    inputCount: events.length,
    outputCount: filtered.length,
    inputEvents: events.map((event) => ({ id: event.id, title: event.title, dueAt: event.dueAt })),
    outputEvents: filtered.map((event) => ({ id: event.id, title: event.title, dueAt: event.dueAt })),
  });
  return filtered;
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

function parseFinoraTag(prompt: string) {
  return prompt.match(/(?:^|\s)@([a-z][a-z0-9_]{2,23})\b/i)?.[1]?.toLowerCase() ?? null;
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
  const name = parseRecipientQuery(prompt) ?? (purpose === 'Rent' ? undefined : undefined);

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

function isPaymentRequestIntent(prompt: string) {
  // Paying an existing request / scanning a QR is not "create payment request".
  if (extractPaymentQrFromPrompt(prompt)) return false;
  // SMS inbox payment requests are a separate integration flow.
  if (isSmsRequestsIntent(prompt)) return false;
  return PAYMENT_REQUEST_RE.test(prompt);
}

function extractPaymentQrFromPrompt(prompt: string): ParsedPaymentQr | null {
  const direct = parsePaymentQr(prompt);
  if (direct) return direct;

  const finora = prompt.match(/finora:(?:momo|va):[^\s]+/i);
  if (finora) return parsePaymentQr(finora[0]!);

  const link = prompt.match(/(?:https?:\/\/)?(?:www\.)?pay\.finora\.app\/r\/[A-Za-z0-9_-]+/i);
  if (link) return parsePaymentQr(link[0]!);

  if (/\bpay\b/i.test(prompt)) {
    const crypto = prompt.match(/\b(0x[a-fA-F0-9]{20,}|T[1-9A-HJ-NP-Za-km-z]{25,})\b/);
    if (crypto) return parsePaymentQr(crypto[1]!);
  }

  return null;
}

function isScanPayIntent(prompt: string) {
  const qr = extractPaymentQrFromPrompt(prompt);
  if (!qr) return false;
  // Require explicit pay / amount / payment-request phrasing so raw addresses in other contexts don't fire.
  return (
    /\bpay\b/i.test(prompt) ||
    /\bpayment\s+request\b/i.test(prompt) ||
    qr.amount != null ||
    Boolean(qr.preparationId)
  );
}

function parseSendFromWallet(prompt: string): string | undefined {
  const m = prompt.match(
    /\bsend(?:\s+money)?\s+from\s+my\s+(usd|ghs|eur|gbp|usdt|usdc)\s+wallet\b/i,
  );
  return m?.[1]?.toUpperCase();
}

function isSendIntent(prompt: string) {
  return (
    SEND_RE.test(prompt) &&
    !RECEIVE_RE.test(prompt) &&
    !FUND_RE.test(prompt) &&
    !isPaymentRequestIntent(prompt) &&
    !CONVERT_RE.test(prompt) &&
    !isInvoiceIntent(prompt) &&
    !isRecurringIntent(prompt) &&
    !isPayrollIntent(prompt) &&
    !isListSuppliersIntent(prompt) &&
    !isListEmployeesIntent(prompt) &&
    !isCreateEmployeeIntent(prompt)
  );
}

function isFundIntent(prompt: string) {
  return FUND_RE.test(prompt) && !isPaymentRequestIntent(prompt) && !isSendIntent(prompt);
}

function isReceiveIntent(prompt: string) {
  return RECEIVE_RE.test(prompt) && !isPaymentRequestIntent(prompt) && !isFundIntent(prompt);
}

function isBalanceIntent(prompt: string) {
  return (
    BALANCE_RE.test(prompt) &&
    !isSendIntent(prompt) &&
    !isFundIntent(prompt) &&
    !isReceiveIntent(prompt) &&
    !isInvoiceIntent(prompt) &&
    !isRecurringIntent(prompt)
  );
}

function isConvertIntent(prompt: string) {
  return CONVERT_RE.test(prompt);
}

function parseAmount(prompt: string): { amount: number; currency: string } | null {
  const euro = prompt.match(/€\s*(\d+(?:\.\d{1,2})?)/);
  if (euro) {
    const amount = Number(euro[1]);
    if (Number.isFinite(amount) && amount > 0) return { amount, currency: 'EUR' };
  }
  const pounds = prompt.match(/£\s*(\d+(?:\.\d{1,2})?)/);
  if (pounds) {
    const amount = Number(pounds[1]);
    if (Number.isFinite(amount) && amount > 0) return { amount, currency: 'GBP' };
  }
  const withCurrency =
    prompt.match(
      /(?:(?:ghs|usd|eur|gbp|ngn|kes|cad|aed|usdt|usdc)\s*)?(\d+(?:\.\d{1,2})?)\s*(ghs|usd|eur|gbp|ngn|kes|cad|aed|usdt|usdc)?/i,
    ) ?? null;
  if (!withCurrency) return null;
  const amount = Number(withCurrency[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const currency = (
    withCurrency[2] ??
    withCurrency[0].match(/ghs|usd|eur|gbp|ngn|kes|cad|aed|usdt|usdc/i)?.[0] ??
    'GHS'
  ).toUpperCase();
  return { amount, currency };
}

function parseCurrencyHint(prompt: string): string | undefined {
  return prompt.match(/\b(ghs|usd|eur|gbp|ngn|kes|cad|aed|usdt|usdc)\b/i)?.[1]?.toUpperCase();
}

const COUNTRY_ALIASES: Record<string, string> = {
  ghana: 'GH',
  nigeria: 'NG',
  kenya: 'KE',
  uganda: 'UG',
  tanzania: 'TZ',
  'south africa': 'ZA',
  germany: 'DE',
  france: 'FR',
  netherlands: 'NL',
  holland: 'NL',
  'united kingdom': 'GB',
  uk: 'GB',
  britain: 'GB',
  england: 'GB',
  'united states': 'US',
  usa: 'US',
  america: 'US',
  canada: 'CA',
  uae: 'AE',
  dubai: 'AE',
  india: 'IN',
  japan: 'JP',
  china: 'CN',
};

function parseDestinationCountry(prompt: string): string | undefined {
  const lower = prompt.toLowerCase();
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(lower)) return code;
  }
  const iso = prompt.match(/\bto\s+([A-Z]{2})\b/);
  if (iso && COUNTRY_ALIASES[iso[1]!.toLowerCase()] === undefined) {
    const code = iso[1]!.toUpperCase();
    if (
      [
        'GH',
        'NG',
        'KE',
        'UG',
        'TZ',
        'ZA',
        'DE',
        'FR',
        'NL',
        'GB',
        'US',
        'CA',
        'AE',
        'IN',
        'JP',
        'CN',
      ].includes(code)
    ) {
      return code;
    }
  }
  return undefined;
}

function parseSettlementMethod(
  prompt: string,
  destination: PaymentConfirmation['destination'] | null,
):
  | 'MOMO'
  | 'LOCAL_BANK'
  | 'ACH'
  | 'WIRE'
  | 'FPS'
  | 'CHAPS'
  | 'SEPA'
  | 'SWIFT'
  | 'CRYPTO'
  | undefined {
  if (/\b(sepa)\b/i.test(prompt)) return 'SEPA';
  if (/\b(fps|faster payments?)\b/i.test(prompt)) return 'FPS';
  if (/\b(chaps)\b/i.test(prompt)) return 'CHAPS';
  if (/\b(ach)\b/i.test(prompt)) return 'ACH';
  if (/\b(wire|fedwire)\b/i.test(prompt)) return 'WIRE';
  if (/\b(swift)\b/i.test(prompt)) return 'SWIFT';
  if (/\b(momo|mobile money|mtn|telecel)\b/i.test(prompt)) return 'MOMO';
  if (destination?.kind === 'crypto_wallet') return 'CRYPTO';
  if (destination?.kind === 'mobile_money') return 'MOMO';
  if (destination?.kind === 'bank_account') {
    const v = destination.value.toUpperCase();
    if (/^[A-Z]{2}\d{2}/.test(v)) {
      if (v.startsWith('GB')) return 'FPS';
      if (v.startsWith('DE') || v.startsWith('FR') || v.startsWith('NL')) return 'SEPA';
      return 'SWIFT';
    }
    return 'LOCAL_BANK';
  }
  return undefined;
}

function countryFromIban(iban: string): string | undefined {
  const cc = iban.slice(0, 2).toUpperCase();
  const map: Record<string, string> = {
    GB: 'GB',
    DE: 'DE',
    FR: 'FR',
    NL: 'NL',
    AE: 'AE',
  };
  return map[cc];
}

function enrichPrepareArgs(
  prompt: string,
  base: ToolCallMessagePart['args'],
  destination: PaymentConfirmation['destination'] | null,
): ToolCallMessagePart['args'] {
  const country =
    parseDestinationCountry(prompt) ??
    (destination?.kind === 'bank_account' && /^[A-Z]{2}\d{2}/i.test(destination.value)
      ? countryFromIban(destination.value)
      : destination?.kind === 'mobile_money'
        ? 'GH'
        : undefined);
  const settlementMethod = parseSettlementMethod(prompt, destination);
  const funding =
    parseSendFromWallet(prompt) ?? (typeof base.currency === 'string' ? base.currency : undefined);

  return {
    ...base,
    ...(country ? { destinationCountry: country } : {}),
    ...(settlementMethod ? { settlementMethod } : {}),
    ...(funding ? { fundingCurrency: funding } : {}),
    ...(destination?.kind === 'bank_account' && /^[A-Z]{2}\d{2}/i.test(destination.value)
      ? { iban: destination.value.toUpperCase() }
      : {}),
    ...(settlementMethod === 'CRYPTO'
      ? { blockchain: destination?.label?.includes('ETH') ? 'ETHEREUM' : 'TRON' }
      : {}),
  };
}

function parsePrefer(prompt: string): 'virtual_account' | 'mobile_money' | 'crypto' | undefined {
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
  return listFundingMethods().map(({ source: _source, ...method }) => method);
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

function buildMockConversion(prompt: string): ConversionQuote {
  const pair =
    prompt.match(
      /\b(usd|ghs|eur|gbp|usdt|usdc)\s*(?:to|into|->)\s*(usd|ghs|eur|gbp|usdt|usdc)\b/i,
    ) ?? null;
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
const finoraMockAdapter = {
  async *run({
    messages,
    abortSignal,
    getToken,
  }: {
    messages: readonly ThreadMessage[];
    abortSignal: AbortSignal;
    getToken?: () => Promise<string | null>;
  }) {
    const prompt = lastUserText(messages);

    if (isScanPayIntent(prompt)) {
      const qr = extractPaymentQrFromPrompt(prompt)!;
      const parsedAmount = parseAmount(prompt);
      const amount = parsedAmount?.amount ?? qr.amount;
      const currency = parsedAmount?.currency ?? qr.currency;
      if (amount == null || amount <= 0) {
        yield {
          content: [
            {
              type: 'text',
              text: 'I found a payment QR but need an amount — open Scan again or say e.g. “Pay 50 GHS to …” with the payload.',
            },
          ],
        };
        return;
      }

      const args = enrichPrepareArgs(
        prompt,
        {
          amount,
          currency,
          recipientName: mockRecipientNameForQr(qr),
          destinationKind: qr.destination.kind,
          destinationLabel: qr.destination.label,
          destinationValue: qr.destination.value,
          reference:
            qr.reference ?? (qr.preparationId ? `Request ${qr.preparationId}` : 'QR payment'),
        },
        qr.destination,
      );
      const argsText = JSON.stringify(args);
      const reasoning = `Scanned payment QR.\nPreparing ${currency} ${amount} to ${qr.destination.label}…`;

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_payment_qr',
            toolName: 'prepare_payment',
            args,
            argsText,
          },
        ],
      };

      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: `${reasoning}\nReady to confirm.` },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_payment_qr',
            toolName: 'prepare_payment',
            args,
            argsText,
          },
          {
            type: 'text',
            text: `Confirm ${currency} ${amount} to ${args.recipientName} (${qr.destination.label}).`,
          },
        ],
      };
      return;
    }

    if (isFinancialPlanIntent(prompt)) {
      const plan = { ...MOCK_BUSINESS_PLAN };
      const args = {
        intent: plan.intent,
        currency: plan.currency,
        total: plan.total,
        items: plan.items,
        planId: plan.planId,
      };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Multi-item business plan requested.\nGathering payroll, rent, invoices, and supplier amounts due today…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_create_financial_plan',
            toolName: 'create_financial_plan',
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
            text: `${reasoning}\nBuilt a ${plan.items.length}-item plan totaling ${plan.currency} ${plan.total}.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_create_financial_plan',
            toolName: 'create_financial_plan',
            args,
            argsText,
            result: {
              status: 'pending' as const,
              planId: plan.planId,
              preparationId: `prep_${plan.planId}`,
            },
          },
          {
            type: 'text',
            text: `Here’s a plan for “${plan.intent}”: ${plan.items.length} line items. Review each row, then Approve all with your passcode — or open Approvals in the drawer for the same plan from Claude Desktop.`,
          },
        ],
      };
      return;
    }

    if (isBusinessFeatureIntent(prompt) && !isBusinessAccount()) {
      yield {
        content: [{ type: 'text', text: businessOnlyMessage() }],
      };
      return;
    }

    if (isTreasuryIntent(prompt)) {
      const args = {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Treasury overview requested.\nAggregating wallets and upcoming outflows…';
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;
      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_get_treasury_overview',
            toolName: 'get_treasury_overview',
            args,
            argsText,
          },
        ],
      };
      await wait(500);
      if (abortSignal.aborted) return;
      const overview = await getTreasuryOverview();
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nBuilt treasury snapshot.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_get_treasury_overview',
            toolName: 'get_treasury_overview',
            args,
            argsText,
            result: { overview },
          },
          {
            type: 'text',
            text: `Treasury snapshot ready — ${overview.balances.length} wallets and ${overview.upcomingOutflows.length} upcoming outflow line${overview.upcomingOutflows.length === 1 ? '' : 's'}.`,
          },
        ],
      };
      return;
    }

    if (isListExpensesIntent(prompt)) {
      const expenses = await listExpenses();
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      const args = {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Business expenses requested.\nLoading card and vendor spend…';
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;
      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_expenses',
            toolName: 'list_expenses',
            args,
            argsText,
          },
        ],
      };
      await wait(400);
      if (abortSignal.aborted) return;
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${expenses.length} expense(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_expenses',
            toolName: 'list_expenses',
            args,
            argsText,
            result: { expenses, total, currency: 'USD' },
          },
          {
            type: 'text',
            text: `Business expenses this month: USD ${total.toLocaleString()} across ${expenses.length} charge${expenses.length === 1 ? '' : 's'}.`,
          },
        ],
      };
      return;
    }

    if (isListBeneficiariesIntent(prompt)) {
      const beneficiaries = await listBeneficiaries();
      const args = {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Beneficiaries requested.\nLoading verified payout destinations…';
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;
      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_beneficiaries',
            toolName: 'list_beneficiaries',
            args,
            argsText,
          },
        ],
      };
      await wait(400);
      if (abortSignal.aborted) return;
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${beneficiaries.length}.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_beneficiaries',
            toolName: 'list_beneficiaries',
            args,
            argsText,
            result: { beneficiaries },
          },
          {
            type: 'text',
            text: `You have ${beneficiaries.length} payout beneficiar${beneficiaries.length === 1 ? 'y' : 'ies'} on file.`,
          },
        ],
      };
      return;
    }

    if (isListPoliciesIntent(prompt)) {
      const policies = await listPolicies();
      const amount = parseAmount(prompt);
      const amountUsd = amount?.currency === 'USD' ? amount.amount : amount?.amount;
      const isNewRecipient = /\bnew (recipient|beneficiary|supplier)\b/i.test(prompt);
      const simulation =
        amountUsd != null
          ? simulatePolicy(policies, amountUsd, isNewRecipient || /\bnew\b/i.test(prompt))
          : undefined;
      const args = { ...(amountUsd == null ? {} : { amountUsd }), isNewRecipient };
      const argsText = JSON.stringify(args);
      const reasoning = 'Approval policies requested.\nLoading rules…';
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;
      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_policies',
            toolName: 'list_policies',
            args,
            argsText,
          },
        ],
      };
      await wait(400);
      if (abortSignal.aborted) return;
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\n${policies.length} policy rule(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_policies',
            toolName: 'list_policies',
            args,
            argsText,
            result: simulation ? { policies, simulation } : { policies },
          },
          {
            type: 'text',
            text: simulation
              ? simulation.requiresApproval
                ? 'That action would require your approval under the current policies.'
                : 'That action would not trip an enabled policy — approval may still be required for money movement.'
              : `You have ${policies.filter((p) => p.enabled).length} enabled approval polic${policies.filter((p) => p.enabled).length === 1 ? 'y' : 'ies'}.`,
          },
        ],
      };
      return;
    }

    if (isListAutomationsIntent(prompt)) {
      const automations = await listAutomations();
      const args = {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Automations requested.\nLoading business rules…';
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;
      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_automations',
            toolName: 'list_automations',
            args,
            argsText,
          },
        ],
      };
      await wait(400);
      if (abortSignal.aborted) return;
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${automations.length}.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_automations',
            toolName: 'list_automations',
            args,
            argsText,
            result: { automations },
          },
          {
            type: 'text',
            text: `${automations.filter((a) => a.status === 'active').length} active automation${automations.filter((a) => a.status === 'active').length === 1 ? '' : 's'} — they only prepare actions, never settle money.`,
          },
        ],
      };
      return;
    }

    if (isFinancialReportIntent(prompt)) {
      const expenses = await listExpenses();
      const outflow = expenses.reduce((s, e) => s + e.amount, 0);
      const inflow = 12400;
      const report = {
        title: 'Business financial summary',
        period: defaultPayrollPeriod(),
        inflow,
        outflow,
        net: inflow - outflow,
        currency: 'USD',
        highlights: [
          `Card/SaaS spend ${outflow.toLocaleString()} USD this month.`,
          'Payroll is the largest upcoming outflow — run it from chat when ready.',
          'Operating USD float is tracked under Treasury.',
        ],
      };
      const args = { period: report.period };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Financial report requested.\nSummarizing inflows, expenses, and cash position…';
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;
      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_generate_financial_insights',
            toolName: 'generate_financial_insights',
            args,
            argsText,
          },
        ],
      };
      await wait(500);
      if (abortSignal.aborted) return;
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nReport ready.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_generate_financial_insights',
            toolName: 'generate_financial_insights',
            args,
            argsText,
            result: { report },
          },
          {
            type: 'text',
            text: `Here’s your ${report.period} business summary. Net ${report.currency} ${report.net.toLocaleString()}.`,
          },
        ],
      };
      return;
    }

    if (isVirtualAccountsIntent(prompt)) {
      const accounts = listFundingMethods().filter((m) => m.kind === 'virtual_account');
      const args = {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Virtual accounts requested.\nLoading receive bank details…';
      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;
      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_virtual_accounts',
            toolName: 'list_virtual_accounts',
            args,
            argsText,
          },
        ],
      };
      await wait(400);
      if (abortSignal.aborted) return;
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${accounts.length}.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_virtual_accounts',
            toolName: 'list_virtual_accounts',
            args,
            argsText,
            result: { accounts },
          },
          {
            type: 'text',
            text: `You have ${accounts.length} virtual account${accounts.length === 1 ? '' : 's'} for bank deposits. Say “Receive money” for the full share card.`,
          },
        ],
      };
      return;
    }

    if (isPayrollIntent(prompt)) {
      const period = defaultPayrollPeriod();
      const employees = await listActiveEmployees();
      const total = employees.reduce((sum, e) => sum + e.salary, 0);
      const currency = employees[0]?.currency ?? 'USD';
      const args = {
        period,
        employeeIds: employees.map((e) => e.id),
      };
      const argsText = JSON.stringify(args);
      const reasoning = 'Payroll run requested.\nLoading active employees and summing salaries…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_payroll',
            toolName: 'prepare_payroll',
            args,
            argsText,
          },
        ],
      };

      await wait(550);
      if (abortSignal.aborted) return;

      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nPrepared ${employees.length} salary line(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_prepare_payroll',
            toolName: 'prepare_payroll',
            args,
            argsText,
            result: {
              period,
              employees,
              total,
              currency,
              preparationId: `prep_payroll_${Date.now()}`,
            },
          },
          {
            type: 'text',
            text:
              employees.length > 0
                ? `Payroll for ${period}: ${employees.length} employee${
                    employees.length === 1 ? '' : 's'
                  }, ${currency} ${total.toLocaleString()}. Approve with your passcode — each salary settles as its own payout.`
                : 'No active employees on the roster. Open Payroll to add your team.',
          },
        ],
      };
      return;
    }

    if (isListEmployeesIntent(prompt)) {
      const employees = await listActiveEmployees();
      const args = {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Team roster requested.\nLoading employees…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_employees',
            toolName: 'list_employees',
            args,
            argsText,
          },
        ],
      };

      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${employees.length} employee(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_employees',
            toolName: 'list_employees',
            args,
            argsText,
            result: { employees },
          },
          {
            type: 'text',
            text:
              employees.length > 0
                ? `Here’s your team (${employees.length}). Say “Run payroll” when you’re ready to pay them.`
                : 'No employees yet. Try “Add employee Ama Boateng designer 2500 USD”.',
          },
        ],
      };
      return;
    }

    if (isCreateEmployeeIntent(prompt)) {
      const seed = parseCreateEmployeeSeed(prompt);
      const args = seed ?? {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Add employee requested.\nSaving to the business roster…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_create_employee',
            toolName: 'create_employee',
            args,
            argsText,
          },
        ],
      };

      await wait(450);
      if (abortSignal.aborted) return;

      if (!seed) {
        yield {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_create_employee',
              toolName: 'create_employee',
              args,
              argsText,
              result: {},
            },
            {
              type: 'text',
              text: 'Tell me the name, role, and salary — e.g. “Add employee Ama Boateng designer 2500 USD”.',
            },
          ],
        };
        return;
      }

      const employee = await createEmployee({
        name: seed.name,
        role: seed.role,
        salary: seed.salary,
        currency: seed.currency,
        destination: {
          kind: 'bank_account',
          label: 'Bank · ACH',
          value: '•••• pending',
          beneficiaryAccountId: `ba_emp_${Date.now().toString(36)}`,
          rail: 'ACH',
        },
      });

      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nSaved ${employee.name}.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_create_employee',
            toolName: 'create_employee',
            args,
            argsText,
            result: { employee },
          },
          {
            type: 'text',
            text: `Added ${employee.name} to Payroll. Open the roster anytime from the drawer.`,
          },
        ],
      };
      return;
    }

    if (isListSuppliersIntent(prompt)) {
      const suppliers = await listSuppliers();
      const args = {};
      const argsText = JSON.stringify(args);
      const reasoning = 'Supplier directory requested.\nLoading saved vendors…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_suppliers',
            toolName: 'list_suppliers',
            args,
            argsText,
          },
        ],
      };

      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${suppliers.length} supplier(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_suppliers',
            toolName: 'list_suppliers',
            args,
            argsText,
            result: { suppliers },
          },
          {
            type: 'text',
            text:
              suppliers.length > 0
                ? `You have ${suppliers.length} supplier${
                    suppliers.length === 1 ? '' : 's'
                  }. Try “Pay TechFlow 780 GBP”.`
                : 'No suppliers saved yet.',
          },
        ],
      };
      return;
    }

    if (
      /\b(pay|send|payout)\b/i.test(prompt) &&
      !isFinancialPlanIntent(prompt) &&
      !isPayrollIntent(prompt)
    ) {
      const employees = await listActiveEmployees();
      const matchedEmployee = employees.find((e) => {
        const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const first = e.name.split(/\s+/)[0] ?? '';
        return (
          new RegExp(`\\b${escape(e.name)}\\b`, 'i').test(prompt) ||
          (first.length > 2 && new RegExp(`\\b${escape(first)}\\b`, 'i').test(prompt))
        );
      });
      if (matchedEmployee) {
        if (!isBusinessAccount()) {
          yield { content: [{ type: 'text', text: businessOnlyMessage() }] };
          return;
        }
        const parsed = parseAmount(prompt);
        const amount = parsed?.amount ?? 500;
        const currency = parsed?.currency ?? matchedEmployee.currency;
        const memo = /\bbonus\b/i.test(prompt)
          ? 'Bonus'
          : /\bsalary\b/i.test(prompt)
            ? 'Salary'
            : 'Employee payment';
        const args = {
          employeeId: matchedEmployee.id,
          amount,
          currency,
          memo,
        };
        const argsText = JSON.stringify(args);
        const reasoning = `Employee payment requested.\nPreparing payout to ${matchedEmployee.name}…`;
        yield { content: [{ type: 'reasoning', text: reasoning }] };
        await wait(400);
        if (abortSignal.aborted) return;
        yield {
          content: [
            { type: 'reasoning', text: reasoning },
            {
              type: 'tool-call',
              toolCallId: 'call_prepare_employee_payment',
              toolName: 'prepare_employee_payment',
              args,
              argsText,
            },
          ],
        };
        await wait(500);
        if (abortSignal.aborted) return;
        yield {
          content: [
            {
              type: 'reasoning',
              text: `${reasoning}\nReady to confirm.`,
            },
            {
              type: 'tool-call',
              toolCallId: 'call_prepare_employee_payment',
              toolName: 'prepare_employee_payment',
              args,
              argsText,
              result: {
                employee: matchedEmployee,
                amount,
                currency,
                memo,
              },
            },
            {
              type: 'text',
              text: `Ready to pay ${matchedEmployee.name} ${currency} ${amount.toLocaleString()} (${memo}). Approve with your passcode.`,
            },
          ],
        };
        return;
      }
    }

    {
      const suppliers = await listSuppliers();
      const matched =
        /\b(pay|send|payout)\b/i.test(prompt) && !isFinancialPlanIntent(prompt)
          ? suppliers.find((s) => {
              const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const first = s.name.split(/\s+/)[0] ?? '';
              return (
                new RegExp(`\\b${escape(s.name)}\\b`, 'i').test(prompt) ||
                (first.length > 2 && new RegExp(`\\b${escape(first)}\\b`, 'i').test(prompt))
              );
            })
          : null;

      if (matched) {
        if (!isBusinessAccount()) {
          yield {
            content: [{ type: 'text', text: businessOnlyMessage() }],
          };
          return;
        }

        const parsed = parseAmount(prompt);
        const amount = parsed?.amount ?? matched.defaultAmount ?? 500;
        const currency = parsed?.currency ?? matched.currency;
        const reference = prompt.match(/\b(INV[- ]?\d+|invoice\s+\d+)\b/i)?.[1] ?? undefined;
        const args = {
          supplierId: matched.id,
          supplierName: matched.name,
          amount: { amount, currency },
          reference,
        };
        const argsText = JSON.stringify(args);
        const reasoning = `Supplier payment requested.\nPreparing payout to ${matched.name}…`;

        yield { content: [{ type: 'reasoning', text: reasoning }] };
        await wait(400);
        if (abortSignal.aborted) return;

        yield {
          content: [
            { type: 'reasoning', text: reasoning },
            {
              type: 'tool-call',
              toolCallId: 'call_prepare_supplier_payment',
              toolName: 'prepare_supplier_payment',
              args,
              argsText,
            },
          ],
        };

        await wait(500);
        if (abortSignal.aborted) return;

        yield {
          content: [
            {
              type: 'reasoning',
              text: `${reasoning}\nReady to confirm.`,
            },
            {
              type: 'tool-call',
              toolCallId: 'call_prepare_supplier_payment',
              toolName: 'prepare_supplier_payment',
              args,
              argsText,
              result: {
                supplier: matched,
                amount,
                currency,
                reference,
                preparationId: `prep_sup_${matched.id}_${Date.now()}`,
              },
            },
            {
              type: 'text',
              text: `Ready to pay ${matched.name} ${currency} ${amount.toLocaleString()} via ${matched.destination.label}. Approve with your passcode.`,
            },
          ],
        };
        return;
      }
    }

    if (isCreateCardIntent(prompt)) {
      const seed = parseCardSeed(prompt);
      const args = { ...seed };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Virtual card requested.\nOpening issue wizard for label, currency, and spend limit…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_create_virtual_card',
            toolName: 'create_virtual_card',
            args,
            argsText,
          },
        ],
      };

      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: `${reasoning}\nWizard ready.` },
          {
            type: 'tool-call',
            toolCallId: 'call_create_virtual_card',
            toolName: 'create_virtual_card',
            args,
            argsText,
          },
          {
            type: 'text',
            text: seed.label
              ? `Let’s issue a ${seed.label} card${seed.spendLimit ? ` with a ${seed.spendLimit} limit` : ''}. Confirm the details and approve with your passcode.`
              : 'Let’s issue a virtual card. Pick a purpose, currency, and spend limit — then approve with your passcode.',
          },
        ],
      };
      return;
    }

    if (isManageCardIntent(prompt)) {
      let card = await resolveManagedCard(prompt);
      const lower = prompt.toLowerCase();
      if (card) {
        if (/\bfreeze\b/i.test(lower) && !/\bunfreeze\b/i.test(lower) && card.status === 'active') {
          card = (await setVirtualCardStatus(card.id, 'frozen')) ?? card;
        } else if (/\bunfreeze\b/i.test(lower) && card.status === 'frozen') {
          card = (await setVirtualCardStatus(card.id, 'active')) ?? card;
        } else if (/\bcancel\b/i.test(lower) && card.status !== 'cancelled') {
          card = (await setVirtualCardStatus(card.id, 'cancelled')) ?? card;
        }
      }
      const args = { cardId: card?.id, label: card?.label };
      const argsText = JSON.stringify(args);
      const reasoning = 'Virtual card management requested.\nLoading card controls…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_get_virtual_card',
            toolName: 'get_virtual_card',
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
            text: `${reasoning}\n${card ? `Card ${card.label} ready.` : 'No matching card.'}`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_get_virtual_card',
            toolName: 'get_virtual_card',
            args,
            argsText,
            result: { card },
          },
          {
            type: 'text',
            text: card
              ? `${card.label} •••• ${card.last4} is ${card.status}. Reveal details, edit the limit, or freeze from here — also under Cards in the drawer.`
              : 'I couldn’t find that card. Try “Show my cards” or create one first.',
          },
        ],
      };
      return;
    }

    if (isListCardsIntent(prompt)) {
      const cards = await listVirtualCards();
      const activeOnly = /\bfrozen\b/i.test(prompt)
        ? cards.filter((c) => c.status === 'frozen')
        : cards.filter((c) => c.status !== 'cancelled');
      const args = { status: 'all' as const };
      const argsText = JSON.stringify(args);
      const reasoning = 'Virtual cards requested.\nLoading issued cards…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_virtual_cards',
            toolName: 'list_virtual_cards',
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
            text: `${reasoning}\nFound ${activeOnly.length} card(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_virtual_cards',
            toolName: 'list_virtual_cards',
            args,
            argsText,
            result: { cards: activeOnly },
          },
          {
            type: 'text',
            text:
              activeOnly.length > 0
                ? `You have ${activeOnly.length} virtual card${activeOnly.length === 1 ? '' : 's'}. Tap one to manage, or open Cards in the drawer.`
                : 'No virtual cards yet. Try “Create a virtual card for Netflix with a $50 limit.”',
          },
        ],
      };
      return;
    }

    if (isInvoiceIntent(prompt)) {
      const invoices = buildMockDueInvoices();
      const args = { source: 'gmail' as const, status: 'due' as const };
      const argsText = JSON.stringify(args);
      const reasoning = 'Supplier invoices requested.\nChecking Gmail connection and unpaid bills…';

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

    if (isCalendarDuesIntent(prompt)) {
      const range = /\bmonth\b/i.test(prompt) ? ('month' as const) : ('week' as const);
      const args = { range };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Calendar events requested.\nChecking your connected Google Calendars for upcoming events…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_calendar_dues',
            toolName: 'list_calendar_dues',
            args,
            argsText,
          },
        ],
      };

      await wait(600);
      if (abortSignal.aborted) return;

      if (!getToken) {
        yield {
          content: [
            {
              type: 'reasoning',
              text: `${reasoning}\nCalendar not connected.`,
            },
            {
              type: 'tool-call',
              toolCallId: 'call_list_calendar_dues',
              toolName: 'list_calendar_dues',
              args,
              argsText,
              result: { connected: false, events: [] },
            },
            {
              type: 'text',
              text: 'Google Calendar isn’t connected. Open Integrations to connect it, then ask again.',
            },
          ],
        };
        return;
      }

      let remoteEvents: Awaited<ReturnType<typeof getCalendarEvents>>;
      try {
        remoteEvents = await getCalendarEvents(getToken);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load Google Calendar.';
        yield {
          content: [
            { type: 'reasoning', text: `${reasoning}\nCalendar request failed.` },
            {
              type: 'tool-call',
              toolCallId: 'call_list_calendar_dues',
              toolName: 'list_calendar_dues',
              args,
              argsText,
              result: { connected: true, events: [], error: message },
            },
            { type: 'text', text: `I couldn’t load your Google Calendar: ${message}` },
          ],
        };
        return;
      }
      const events = filterEventsByRange(remoteEvents, range).map((event) => ({
        ...event,
        amount: event.amount ?? undefined,
        currency: event.currency ?? undefined,
        counterparty: event.counterparty ?? undefined,
        notes: event.notes ?? undefined,
        status: 'upcoming' as const,
      }));
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${events.length} upcoming calendar event(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_calendar_dues',
            toolName: 'list_calendar_dues',
            args,
            argsText,
            result: { connected: true, events },
          },
          {
            type: 'text',
            text:
              events.length > 0
                ? `Found ${events.length} calendar event${events.length === 1 ? '' : 's'} on your calendar this ${range}.`
                : `No upcoming calendar events on your calendar this ${range}.`,
          },
        ],
      };
      return;
    }

    if (isSmsRequestsIntent(prompt)) {
      const args = { status: 'new' as const };
      const argsText = JSON.stringify(args);
      const reasoning =
        'SMS payment requests requested.\nScanning connected SMS inbox for MoMo prompts and payment asks…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_list_sms_requests',
            toolName: 'list_sms_requests',
            args,
            argsText,
          },
        ],
      };

      await wait(600);
      if (abortSignal.aborted) return;

      const integrations = await getIntegrations();
      if (!integrations.smsConnected) {
        yield {
          content: [
            {
              type: 'reasoning',
              text: `${reasoning}\nSMS not connected.`,
            },
            {
              type: 'tool-call',
              toolCallId: 'call_list_sms_requests',
              toolName: 'list_sms_requests',
              args,
              argsText,
              result: { connected: false, requests: [] },
            },
            {
              type: 'text',
              text: 'SMS isn’t connected. Open Integrations → Connect SMS (needs a device that can send SMS), then ask again.',
            },
          ],
        };
        return;
      }

      const requests = await listOpenSmsPaymentRequests();
      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nFound ${requests.length} open request(s).`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_list_sms_requests',
            toolName: 'list_sms_requests',
            args,
            argsText,
            result: { connected: true, requests },
          },
          {
            type: 'text',
            text:
              requests.length > 0
                ? `Found ${requests.length} payment request${requests.length === 1 ? '' : 's'} in SMS. Pay any with your passcode, or dismiss ones you can ignore.`
                : 'No open payment requests in SMS right now.',
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

    if (isPaymentRequestIntent(prompt)) {
      const parsed = parseAmount(prompt);
      const memoMatch = prompt.match(/\b(?:for|note|memo|because)\s+([a-z0-9][\w\s'-]{1,40})/i);
      const args = {
        amount: parsed?.amount,
        currency: parsed?.currency ?? parseCurrencyHint(prompt),
        memo: memoMatch?.[1]?.trim(),
      };
      const argsText = JSON.stringify(args);
      const reasoning =
        'Payment request / link detected.\nOpening ask-to-pay wizard for amount, note, and shareable link…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_create_payment_request',
            toolName: 'create_payment_request',
            args,
            argsText,
          },
        ],
      };

      await wait(400);
      if (abortSignal.aborted) return;

      yield {
        content: [
          {
            type: 'reasoning',
            text: `${reasoning}\nWizard ready — create the link, then share or show QR.`,
          },
          {
            type: 'tool-call',
            toolCallId: 'call_create_payment_request',
            toolName: 'create_payment_request',
            args,
            argsText,
          },
          {
            type: 'text',
            text: 'Set the amount (and an optional note), then share the payment link or QR so someone can pay you.',
          },
        ],
      };
      return;
    }

    if (isFundIntent(prompt)) {
      const currency = parseCurrencyHint(prompt);
      const source = inferFundingSource(prompt);
      const parsedAmount = parseAmount(prompt);
      const args = {
        source,
        currency,
        amount: parsedAmount?.amount,
      };
      const argsText = JSON.stringify(args);
      const reasoning = source
        ? `Funding via ${source.replace('_', ' ')}.\nOpening add-money flow…`
        : 'Add-money request.\nOpening funding options…';

      yield { content: [{ type: 'reasoning', text: reasoning }] };
      await wait(350);
      if (abortSignal.aborted) return;

      yield {
        content: [
          { type: 'reasoning', text: reasoning },
          {
            type: 'tool-call',
            toolCallId: 'call_fund_account',
            toolName: 'fund_account',
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
            toolCallId: 'call_fund_account',
            toolName: 'fund_account',
            args,
            argsText,
          },
          {
            type: 'text',
            text: source
              ? `Let’s add money via ${source === 'momo_pull' ? 'a MoMo charge' : source === 'mobile_money' ? 'mobile money' : source === 'crypto' ? 'crypto' : 'bank transfer'} — follow the steps.`
              : 'How do you want to add money? Bank, mobile money, or crypto.',
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
            text: 'Here are your receive options — switch rails, tap the QR to enlarge, then Share details, Share QR, or Copy all.',
          },
        ],
      };
      return;
    }

    if (isSendIntent(prompt)) {
      const finoraTag = parseFinoraTag(prompt);
      if (finoraTag) {
        const recipient = await lookupFinoraTag(finoraTag);
        const parsedAmount = parseAmount(prompt);

        if (!recipient) {
          yield {
            content: [
              {
                type: 'text',
                text:
                  finoraTag === getCurrentFinoraTag()
                    ? 'You cannot send money to your own Finora Tag.'
                    : `I couldn’t find an active Finora account for @${finoraTag}. Check the tag and try again.`,
              },
            ],
          };
          return;
        }

        if (!parsedAmount) {
          yield {
            content: [
              {
                type: 'text',
                text: `How much do you want to send to ${recipient.displayName} (@${recipient.tag})?`,
              },
            ],
          };
          return;
        }

        if (!recipient.walletCurrencies.includes(parsedAmount.currency)) {
          yield {
            content: [
              {
                type: 'text',
                text: `@${recipient.tag} cannot receive ${parsedAmount.currency} in Finora yet. Their available wallets: ${recipient.walletCurrencies.join(', ')}.`,
              },
            ],
          };
          return;
        }

        const args = {
          fromSubCustomerId: CURRENT_FINORA_ACCOUNT.subCustomerId,
          toSubCustomerId: recipient.subCustomerId,
          amount: {
            value: parsedAmount.amount,
            currency: parsedAmount.currency,
          },
          recipientName: recipient.displayName,
          finoraTag: recipient.tag,
          reference: `Finora transfer to @${recipient.tag}`,
        };
        const argsText = JSON.stringify(args);
        const reasoning = `Resolved @${recipient.tag} to a verified Finora account.\nPreparing an internal wallet transfer…`;

        yield { content: [{ type: 'reasoning', text: reasoning }] };
        await wait(350);
        if (abortSignal.aborted) return;

        yield {
          content: [
            { type: 'reasoning', text: `${reasoning}\nReady for your approval.` },
            {
              type: 'tool-call',
              toolCallId: 'call_prepare_internal_transfer',
              toolName: 'prepare_internal_transfer',
              args,
              argsText,
            },
            {
              type: 'text',
              text: `Review the Finora wallet transfer to ${recipient.displayName} (@${recipient.tag}).`,
            },
          ],
        };
        return;
      }

      const walletCurrency = parseSendFromWallet(prompt);
      if (walletCurrency) {
        const contacts = await listContacts();
        const candidates = contacts.map((c) => ({
          id: c.id,
          name: c.name,
          initials: c.initials,
          currency: c.currency,
          method: c.method,
          identifier: c.identifier,
        }));
        const args = {
          currency: walletCurrency,
          candidates,
          reference: `From ${walletCurrency} wallet`,
        };
        const argsText = JSON.stringify(args);
        const reasoning = `Send from ${walletCurrency} wallet.\nLoading contacts so you can pick who to pay…`;

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
              text: `Sending from your ${walletCurrency} wallet — pick a contact, then the amount.`,
            },
          ],
        };
        return;
      }

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
            const fromContact = contactToSendSeed(contact);
            const args = enrichPrepareArgs(
              prompt,
              {
                amount: parsedAmount.amount,
                currency: parsedAmount.currency || contact.currency,
                recipientName: contact.name,
                destinationKind: dest.kind,
                destinationLabel: dest.label,
                destinationValue: dest.value,
                reference: `To ${contact.name}`,
                ...(fromContact.destinationCountry
                  ? { destinationCountry: fromContact.destinationCountry }
                  : {}),
                ...(fromContact.settlementMethod
                  ? { settlementMethod: fromContact.settlementMethod }
                  : {}),
                ...(fromContact.fundingCurrency
                  ? { fundingCurrency: fromContact.fundingCurrency }
                  : {}),
              },
              dest,
            );
            const argsText = JSON.stringify(args);
            const reasoning = `Found ${contact.name} in contacts.\nPreparing international send…`;

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
                  text: `Found ${contact.name} (${contact.method}). Review the send details to continue.`,
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
            destinationCountry: parseDestinationCountry(prompt),
            settlementMethod: parseSettlementMethod(prompt, null),
            fundingCurrency: parseSendFromWallet(prompt) ?? parsedAmount?.currency,
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
      const reasoning = `Payment request detected.\nPreparing international send wizard…`;
      const args = enrichPrepareArgs(
        prompt,
        {
          amount: payment.amount,
          currency: payment.currency,
          recipientName: payment.recipientName,
          destinationKind: payment.destination.kind,
          destinationLabel: payment.destination.label,
          destinationValue: payment.destination.value,
          ...(payment.reference ? { reference: payment.reference } : {}),
        },
        payment.destination,
      );
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

export function createFinoraChatAdapter(getToken?: () => Promise<string | null>): ChatModelAdapter {
  return {
    async *run(options) {
      for await (const result of finoraMockAdapter.run({ ...options, getToken })) {
        yield JSON.parse(JSON.stringify(result)) as ChatModelRunResult;
      }
    },
  };
}

export const finoraChatAdapter = createFinoraChatAdapter();
