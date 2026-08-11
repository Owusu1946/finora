/** Curated send corridors for the international wizard (mirrors @finora/shared). */

export type SettlementMethod =
  | 'MOMO'
  | 'LOCAL_BANK'
  | 'ACH'
  | 'WIRE'
  | 'FPS'
  | 'CHAPS'
  | 'SEPA'
  | 'SWIFT'
  | 'CRYPTO';

export type PurposeCode =
  | 'GOODS'
  | 'SERVICES'
  | 'SALARY'
  | 'RENT'
  | 'FAMILY_SUPPORT'
  | 'INVOICE'
  | 'OTHER';

export type CorridorFieldKey =
  | 'network'
  | 'phone'
  | 'accountNumber'
  | 'bankCode'
  | 'accountName'
  | 'iban'
  | 'swiftBic'
  | 'sortCode'
  | 'routingNumber'
  | 'accountCategory'
  | 'cryptoAddress'
  | 'blockchain'
  | 'addressLine1'
  | 'city'
  | 'postalCode';

export type CorridorCountry = {
  code: string;
  name: string;
  alpha3: string;
  currency: string;
  rails: SettlementMethod[];
  fields: Partial<Record<SettlementMethod, CorridorFieldKey[]>>;
};

export const SEND_CORRIDORS: CorridorCountry[] = [
  {
    code: 'GH',
    name: 'Ghana',
    alpha3: 'GHA',
    currency: 'GHS',
    rails: ['MOMO', 'LOCAL_BANK'],
    fields: {
      MOMO: ['network', 'phone', 'accountName'],
      LOCAL_BANK: ['bankCode', 'accountNumber', 'accountName'],
    },
  },
  {
    code: 'NG',
    name: 'Nigeria',
    alpha3: 'NGA',
    currency: 'NGN',
    rails: ['LOCAL_BANK'],
    fields: {
      LOCAL_BANK: ['bankCode', 'accountNumber', 'accountName'],
    },
  },
  {
    code: 'KE',
    name: 'Kenya',
    alpha3: 'KEN',
    currency: 'KES',
    rails: ['MOMO', 'LOCAL_BANK'],
    fields: {
      MOMO: ['network', 'phone', 'accountName'],
      LOCAL_BANK: ['bankCode', 'accountNumber', 'accountName'],
    },
  },
  {
    code: 'US',
    name: 'United States',
    alpha3: 'USA',
    currency: 'USD',
    rails: ['ACH', 'WIRE'],
    fields: {
      ACH: [
        'routingNumber',
        'accountNumber',
        'accountCategory',
        'accountName',
        'addressLine1',
        'city',
        'postalCode',
      ],
      WIRE: [
        'routingNumber',
        'accountNumber',
        'accountCategory',
        'accountName',
        'addressLine1',
        'city',
        'postalCode',
      ],
    },
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    alpha3: 'GBR',
    currency: 'GBP',
    rails: ['FPS', 'CHAPS', 'SWIFT'],
    fields: {
      FPS: ['sortCode', 'accountNumber', 'accountName'],
      CHAPS: ['sortCode', 'accountNumber', 'accountName'],
      SWIFT: ['swiftBic', 'iban', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'DE',
    name: 'Germany',
    alpha3: 'DEU',
    currency: 'EUR',
    rails: ['SEPA', 'SWIFT'],
    fields: {
      SEPA: ['iban', 'accountName'],
      SWIFT: ['swiftBic', 'iban', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'FR',
    name: 'France',
    alpha3: 'FRA',
    currency: 'EUR',
    rails: ['SEPA', 'SWIFT'],
    fields: {
      SEPA: ['iban', 'accountName'],
      SWIFT: ['swiftBic', 'iban', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'NL',
    name: 'Netherlands',
    alpha3: 'NLD',
    currency: 'EUR',
    rails: ['SEPA', 'SWIFT'],
    fields: {
      SEPA: ['iban', 'accountName'],
      SWIFT: ['swiftBic', 'iban', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'CA',
    name: 'Canada',
    alpha3: 'CAN',
    currency: 'CAD',
    rails: ['SWIFT'],
    fields: {
      SWIFT: ['swiftBic', 'accountNumber', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    alpha3: 'ARE',
    currency: 'AED',
    rails: ['SWIFT'],
    fields: {
      SWIFT: ['swiftBic', 'iban', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'ZA',
    name: 'South Africa',
    alpha3: 'ZAF',
    currency: 'ZAR',
    rails: ['SWIFT', 'LOCAL_BANK'],
    fields: {
      SWIFT: ['swiftBic', 'accountNumber', 'accountName', 'addressLine1', 'city', 'postalCode'],
      LOCAL_BANK: ['bankCode', 'accountNumber', 'accountName'],
    },
  },
  {
    code: 'IN',
    name: 'India',
    alpha3: 'IND',
    currency: 'INR',
    rails: ['SWIFT'],
    fields: {
      SWIFT: ['swiftBic', 'accountNumber', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'JP',
    name: 'Japan',
    alpha3: 'JPN',
    currency: 'JPY',
    rails: ['SWIFT'],
    fields: {
      SWIFT: ['swiftBic', 'accountNumber', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'CN',
    name: 'China',
    alpha3: 'CHN',
    currency: 'CNH',
    rails: ['SWIFT'],
    fields: {
      SWIFT: ['swiftBic', 'accountNumber', 'accountName', 'addressLine1', 'city', 'postalCode'],
    },
  },
  {
    code: 'UG',
    name: 'Uganda',
    alpha3: 'UGA',
    currency: 'UGX',
    rails: ['MOMO', 'LOCAL_BANK'],
    fields: {
      MOMO: ['network', 'phone', 'accountName'],
      LOCAL_BANK: ['bankCode', 'accountNumber', 'accountName'],
    },
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    alpha3: 'TZA',
    currency: 'TZS',
    rails: ['MOMO', 'LOCAL_BANK'],
    fields: {
      MOMO: ['network', 'phone', 'accountName'],
      LOCAL_BANK: ['bankCode', 'accountNumber', 'accountName'],
    },
  },
];

export const CRYPTO_CORRIDOR = {
  rails: ['CRYPTO'] as SettlementMethod[],
  fields: ['cryptoAddress', 'blockchain', 'accountName'] as CorridorFieldKey[],
  currencies: ['USDT', 'USDC'],
};

export const SETTLEMENT_METHOD_LABELS: Record<SettlementMethod, string> = {
  MOMO: 'Mobile money',
  LOCAL_BANK: 'Local bank',
  ACH: 'ACH',
  WIRE: 'Wire',
  FPS: 'Faster Payments',
  CHAPS: 'CHAPS',
  SEPA: 'SEPA',
  SWIFT: 'SWIFT',
  CRYPTO: 'Crypto',
};

export const PURPOSE_CODE_LABELS: Record<PurposeCode, string> = {
  GOODS: 'Goods',
  SERVICES: 'Services',
  SALARY: 'Salary / payroll',
  RENT: 'Rent',
  FAMILY_SUPPORT: 'Family support',
  INVOICE: 'Invoice',
  OTHER: 'Other',
};

export const PURPOSE_CODES: PurposeCode[] = [
  'GOODS',
  'SERVICES',
  'SALARY',
  'RENT',
  'FAMILY_SUPPORT',
  'INVOICE',
  'OTHER',
];

export const FUNDING_CURRENCIES = ['USD', 'GBP', 'EUR', 'GHS', 'USDT', 'USDC'] as const;

export function getCorridor(countryCode: string): CorridorCountry | undefined {
  return SEND_CORRIDORS.find((c) => c.code === countryCode.toUpperCase());
}

export function railsForCountry(countryCode: string): SettlementMethod[] {
  return getCorridor(countryCode)?.rails ?? [];
}

export function fieldsForRail(countryCode: string, method: SettlementMethod): CorridorFieldKey[] {
  if (method === 'CRYPTO') return CRYPTO_CORRIDOR.fields;
  return getCorridor(countryCode)?.fields[method] ?? [];
}

const MOCK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  GHS: 15.4,
  NGN: 1550,
  KES: 129,
  UGX: 3700,
  TZS: 2600,
  ZAR: 18.2,
  CAD: 1.36,
  AED: 3.67,
  CNH: 7.2,
  INR: 83,
  JPY: 151,
  USDT: 1,
  USDC: 1,
};

export function previewFxQuote(opts: { from: string; to: string; amount: number }) {
  const fromUsd = MOCK_USD_RATES[opts.from] ?? 1;
  const toUsd = MOCK_USD_RATES[opts.to] ?? 1;
  const rate = toUsd / fromUsd;
  const fee = Math.round(opts.amount * 0.004 * 100) / 100;
  const convertedAmount = Math.round((opts.amount - fee) * rate * 100) / 100;
  return {
    from: opts.from,
    to: opts.to,
    rate: Math.round(rate * 1e6) / 1e6,
    fee,
    convertedAmount: Math.max(convertedAmount, 0.01),
  };
}
