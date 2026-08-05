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

/** Aligned with `lib/funding-methods.ts` deposit details. */
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
      bankName: 'ClearBank',
      accountName: 'Finora / Kenneth Owusu',
      iban: 'GB82 CLRB 0406 6800 0123 45',
      swiftBic: 'CLRBGB22',
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
    badge: 'TRC-20',
    accountDetails: {
      network: 'TRC-20 (Tron)',
      address: 'TXyzFinoraMockDepositAddress9hQ2',
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
      bankName: 'Commerzbank',
      accountName: 'Finora / Kenneth Owusu',
      iban: 'DE89 3704 0044 0532 0130 00',
      swiftBic: 'COBADEFFXXX',
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
      bankName: 'NatWest',
      accountName: 'Finora / Kenneth Owusu',
      accountNumber: '31926819',
      routingNumber: '60-16-13',
      swiftBic: 'NWBKGB2L',
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
      phone: '0550123456',
      accountName: 'Kenneth Owusu',
      network: 'MTN Mobile Money',
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
