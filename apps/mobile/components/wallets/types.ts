import { SupportedCurrency } from '@/components/ui/currency-icon';

export type CurrencyType = 'fiat' | 'crypto' | 'momo';

export interface WalletItem {
  id: string;
  currency: SupportedCurrency;
  name: string;
  symbol: string;
  balance: number;
  type: CurrencyType;
  badge: string;
  usdEquivalent: number;
  accountDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    routingNumber?: string;
    iban?: string;
    swiftBic?: string;
    network?: string;
    address?: string;
    phone?: string;
  };
}

export const INITIAL_WALLETS_DATA: WalletItem[] = [
  {
    id: 'w-usd',
    currency: 'USD',
    name: 'US Dollar',
    symbol: '$',
    balance: 6420.5,
    usdEquivalent: 6420.5,
    type: 'fiat',
    badge: 'ACH • Wire • SWIFT',
    accountDetails: {
      bankName: 'Choice Financial Group (WeWire)',
      accountName: 'Finora Business Trust',
      accountNumber: '1892 4892 0184',
      routingNumber: '021000021',
      swiftBic: 'CHUSUS33XXX',
    },
  },
  {
    id: 'w-usdt',
    currency: 'USDT',
    name: 'Tether USD',
    symbol: '₮',
    balance: 3200.0,
    usdEquivalent: 3200.0,
    type: 'crypto',
    badge: 'TRC-20 / ERC-20',
    accountDetails: {
      network: 'TRON (TRC-20)',
      address: 'TY9aN3kL8mPq1zX7vR4wE2yS6tU5jB0hA1',
    },
  },
  {
    id: 'w-eur',
    currency: 'EUR',
    name: 'Euro',
    symbol: '€',
    balance: 2150.0,
    usdEquivalent: 2343.5,
    type: 'fiat',
    badge: 'SEPA Instant IBAN',
    accountDetails: {
      bankName: 'ClearBank Europe',
      accountName: 'Finora Business Trust',
      iban: 'GB82 CLRB 0400 7563 8291 00',
      swiftBic: 'CLRBGB21',
    },
  },
  {
    id: 'w-usdc',
    currency: 'USDC',
    name: 'USD Coin',
    symbol: '$',
    balance: 1500.0,
    usdEquivalent: 1500.0,
    type: 'crypto',
    badge: 'Solana • Polygon',
    accountDetails: {
      network: 'Solana (SPL)',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
  },
  {
    id: 'w-gbp',
    currency: 'GBP',
    name: 'British Pound',
    symbol: '£',
    balance: 1480.0,
    usdEquivalent: 1894.4,
    type: 'fiat',
    badge: 'FPS • Sort Code',
    accountDetails: {
      bankName: 'Barclays WeWire Gateway',
      accountName: 'Finora Business Trust',
      accountNumber: '83920194',
      routingNumber: '04-00-75',
      swiftBic: 'BARCGB22',
    },
  },
  {
    id: 'w-ghs',
    currency: 'GHS',
    name: 'Ghana Cedi',
    symbol: '₵',
    balance: 18500.0,
    usdEquivalent: 1202.5,
    type: 'momo',
    badge: 'MTN / Telecel MoMo',
    accountDetails: {
      phone: '+233 24 555 0192',
      accountName: 'Finora Enterprise MoMo',
    },
  },
];

export const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.09,
  GBP: 1.28,
  USDT: 1.0,
  USDC: 1.0,
  GHS: 0.065,
};
