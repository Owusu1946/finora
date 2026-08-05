import { z } from 'zod';

/** Shared enums aligned with WeWire + Finora product surfaces. */

export const CurrencySchema = z.enum([
  'USD',
  'EUR',
  'GBP',
  'GHS',
  'NGN',
  'KES',
  'UGX',
  'TZS',
  'ZAR',
  'XAF',
  'XOF',
  'CAD',
  'AED',
  'CNH',
  'INR',
  'JPY',
  'USDT',
  'USDC',
]);
export type Currency = z.infer<typeof CurrencySchema>;

export const SubCustomerStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'ARCHIVED',
]);
export type SubCustomerStatus = z.infer<typeof SubCustomerStatusSchema>;

export const SubCustomerTypeSchema = z.enum(['INDIVIDUAL', 'BUSINESS']);
export type SubCustomerType = z.infer<typeof SubCustomerTypeSchema>;

export const SubCustomerPurposeSchema = z.enum([
  'PAYMENTS',
  'PAYROLL',
  'TREASURY',
  'MARKETPLACE',
  'OTHER',
]);
export type SubCustomerPurpose = z.infer<typeof SubCustomerPurposeSchema>;

export const SubCustomerOnboardingStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'REQUIRES_ACTION',
]);
export type SubCustomerOnboardingStatus = z.infer<
  typeof SubCustomerOnboardingStatusSchema
>;

export const WalletStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']);
export type WalletStatus = z.infer<typeof WalletStatusSchema>;

export const AccountStatusSchema = z.enum(['ACTIVE', 'PENDING', 'SUSPENDED', 'CLOSED']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const CryptoWalletStatusSchema = z.enum(['ACTIVE', 'PENDING', 'DISABLED']);
export type CryptoWalletStatus = z.infer<typeof CryptoWalletStatusSchema>;

export const BlockchainNetworkSchema = z.enum([
  'TRON',
  'ETHEREUM',
  'SOLANA',
  'POLYGON',
  'BASE',
]);
export type BlockchainNetwork = z.infer<typeof BlockchainNetworkSchema>;

export const PurposeCodeSchema = z.enum([
  'GOODS',
  'SERVICES',
  'SALARY',
  'RENT',
  'FAMILY_SUPPORT',
  'INVOICE',
  'OTHER',
]);
export type PurposeCode = z.infer<typeof PurposeCodeSchema>;

/** WeWire-shaped settlement rails for international / local payouts. */
export const SettlementMethodSchema = z.enum([
  'MOMO',
  'LOCAL_BANK',
  'ACH',
  'WIRE',
  'FPS',
  'CHAPS',
  'SEPA',
  'SWIFT',
  'CRYPTO',
]);
export type SettlementMethod = z.infer<typeof SettlementMethodSchema>;

export const FxQuoteSchema = z.object({
  from: CurrencySchema,
  to: CurrencySchema,
  rate: z.number().positive(),
  fee: z.number().nonnegative(),
  convertedAmount: z.number().positive(),
});
export type FxQuote = z.infer<typeof FxQuoteSchema>;

export const WalletTransactionTypeSchema = z.enum([
  'PAYOUT',
  'PAYIN',
  'TRANSFER',
  'CONVERSION',
  'DISBURSEMENT',
  'FEE',
  'REFUND',
]);
export type WalletTransactionType = z.infer<typeof WalletTransactionTypeSchema>;

export const WalletTransactionChannelSchema = z.enum([
  'BANK',
  'MOBILE_MONEY',
  'CRYPTO',
  'INTERNAL',
  'FX',
  'CARD',
]);
export type WalletTransactionChannel = z.infer<typeof WalletTransactionChannelSchema>;

export const WalletTransactionStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REQUIRES_APPROVAL',
]);
export type WalletTransactionStatus = z.infer<typeof WalletTransactionStatusSchema>;

export const MobileMoneyNetworkSchema = z.enum([
  'MTN',
  'VODAFONE',
  'AIRTEL',
  'TELECEL',
  'ORANGE',
  'MPESA',
]);
export type MobileMoneyNetwork = z.infer<typeof MobileMoneyNetworkSchema>;

export const ApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'expired',
  'executed',
  'failed',
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const InvoiceStatusSchema = z.enum(['due', 'scheduled', 'paid', 'dismissed']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const RecurringFrequencySchema = z.enum(['weekly', 'monthly', 'quarterly']);
export type RecurringFrequency = z.infer<typeof RecurringFrequencySchema>;

export const RecurringStatusSchema = z.enum(['active', 'paused', 'cancelled']);
export type RecurringStatus = z.infer<typeof RecurringStatusSchema>;

export const MoneyAmountSchema = z.object({
  amount: z.number().positive(),
  currency: CurrencySchema,
});
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

export const DestinationKindSchema = z.enum([
  'mobile_money',
  'bank_account',
  'crypto_wallet',
  'internal_wallet',
]);
export type DestinationKind = z.infer<typeof DestinationKindSchema>;
