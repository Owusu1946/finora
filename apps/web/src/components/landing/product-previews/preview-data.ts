// Curated, deterministic marketing fixtures adapted from Finora's mobile demo screens.
// These are illustrative values, not live accounts or shared product contracts.

export const assistantSuggestions = [
  'Show treasury overview',
  'Run payroll',
  'Pay TechFlow 780 GBP',
  'Show business expenses this month',
  'Pay everything due today',
] as const;

export const previewWallets = [
  {
    currency: 'USD',
    name: 'USD',
    detail: 'US Dollar · ACH · Wire · SWIFT',
    balance: '$6,420.50',
    equivalent: '≈ $6,420.50',
  },
  {
    currency: 'USDT',
    name: 'USDT',
    detail: 'Tether USD · TRC-20',
    balance: '₮3,200.00',
    equivalent: '≈ $3,200.00',
  },
  {
    currency: 'EUR',
    name: 'EUR',
    detail: 'Euro · SEPA Instant IBAN',
    balance: '€2,150.00',
    equivalent: '≈ $2,343.50',
  },
  {
    currency: 'GHS',
    name: 'GHS',
    detail: 'Ghana Cedi · MTN / Telecel MoMo',
    balance: '₵18,500.00',
    equivalent: '≈ $1,202.50',
  },
] as const;

export const previewConversion = {
  fromCurrency: 'USD',
  fromAmount: 'USD 100.00',
  toCurrency: 'GHS',
  toAmount: 'GHS 1,543.80',
  rate: '1 USD = 15.5000 GHS',
  fee: 'USD 0.40',
} as const;

export const previewInvoices = [
  {
    vendor: 'ClearView Partners',
    reference: 'CV-8891 · due 8 Aug · gmail',
    amount: '£1,500.00',
  },
  {
    vendor: 'Cloudflare Inc',
    reference: 'CF-22091 · due 12 Aug · gmail',
    amount: '$80.00',
  },
] as const;

export const previewEmployees = [
  { name: 'Ama Boateng', role: 'Designer · Chase · ACH', amount: '$2,500.00' },
  { name: 'Kwame Mensah', role: 'Engineer · Wise · ACH', amount: '$3,200.00' },
] as const;

export const previewActivity = [
  {
    currency: 'USDT',
    counterparty: 'Yuki Tanaka',
    detail: 'Crypto · 3:48 PM',
    amount: '−₮500.00',
  },
  {
    currency: 'USD',
    counterparty: 'Pay everything due today',
    detail: 'Financial plan · 12:56 PM',
    amount: '−$8,230.00',
  },
  {
    currency: 'GBP',
    counterparty: 'ClearView Partners',
    detail: 'SWIFT · 12:44 PM',
    amount: '−£2,500.00',
  },
  {
    currency: 'GHS',
    counterparty: 'Kwame Mensah',
    detail: 'MoMo MoMo · 10:56 AM',
    amount: '−₵2,500.00',
  },
] as const;
