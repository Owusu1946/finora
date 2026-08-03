/** WeWire API types — expand against https://docs.wewire.com/ */

export type WewireEnvironment = 'sandbox' | 'production';

export type SubCustomerType = 'INDIVIDUAL' | 'BUSINESS';
export type SubCustomerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type SubCustomerOnboardingStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REQUIRES_ACTION';
export type SubCustomerPurpose =
  | 'PAYMENTS'
  | 'PAYROLL'
  | 'TREASURY'
  | 'MARKETPLACE'
  | 'OTHER';

export type WalletStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type BlockchainNetwork = 'TRON' | 'ETHEREUM' | 'SOLANA' | 'POLYGON' | 'BASE';
export type PurposeCode =
  | 'GOODS'
  | 'SERVICES'
  | 'SALARY'
  | 'RENT'
  | 'FAMILY_SUPPORT'
  | 'INVOICE'
  | 'OTHER';

export type WalletTransactionType =
  | 'PAYOUT'
  | 'PAYIN'
  | 'TRANSFER'
  | 'CONVERSION'
  | 'DISBURSEMENT'
  | 'FEE'
  | 'REFUND';

export type WalletTransactionChannel =
  | 'BANK'
  | 'MOBILE_MONEY'
  | 'CRYPTO'
  | 'INTERNAL'
  | 'FX'
  | 'CARD';

export type WalletTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REQUIRES_APPROVAL';

export type MobileMoneyNetwork =
  | 'MTN'
  | 'VODAFONE'
  | 'AIRTEL'
  | 'TELECEL'
  | 'ORANGE'
  | 'MPESA';

export interface WewireWallet {
  id: string;
  balance: string;
  status: WalletStatus;
  currency: string;
  businessId: string;
  subCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WewireSubCustomer {
  id: string;
  type: SubCustomerType;
  email?: string;
  country?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  purpose?: SubCustomerPurpose[];
  onboardingStatus?: SubCustomerOnboardingStatus;
  status?: SubCustomerStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSubCustomerInput {
  type: SubCustomerType;
  email: string;
  country: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  businessType?: 'GENERAL_BUSINESS' | 'SOLE_PROPRIETORSHIP';
  purpose?: SubCustomerPurpose[];
}

export interface SubmitKycInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
}

export interface KycLinkResponse {
  url: string;
  expiresAt: string;
}

export interface KycRequirement {
  id: string;
  label: string;
  required: boolean;
  status: 'missing' | 'uploaded' | 'verified';
}

export interface BeneficialOwnerInput {
  fullName: string;
  ownershipPercent: number;
  nationality?: string;
}

export interface InitiatePayoutInput {
  subCustomerId?: string;
  amount: number;
  currency: string;
  purposeCode: PurposeCode;
  destination: {
    type: 'BANK' | 'MOBILE_MONEY' | 'CRYPTO';
    value: string;
    network?: string;
    accountName?: string;
  };
  reference?: string;
}

export interface WewireTransaction {
  id: string;
  type: WalletTransactionType;
  channel: WalletTransactionChannel;
  status: WalletTransactionStatus;
  amount: string;
  currency: string;
  subCustomerId?: string;
  counterparty?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  wewireId?: string;
}

export interface InternalTransferInput {
  toSubCustomerId: string;
  amount: number;
  currency: string;
  reference?: string;
}

export interface MobileMoneyDisbursementInput {
  amount: number;
  currency: string;
  network: MobileMoneyNetwork;
  phoneNumber: string;
  recipientName?: string;
  reference?: string;
}

export interface FxRate {
  from: string;
  to: string;
  rate: number;
  asOf: string;
}

export interface ConversionPreviewInput {
  from: string;
  to: string;
  amount: number;
  subCustomerId?: string;
}

export interface ConversionPreview {
  from: string;
  to: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
  feeCurrency: string;
  quoteId: string;
  expiresAt: string;
}
