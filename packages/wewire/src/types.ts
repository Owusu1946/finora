/** Minimal WeWire types used by Finora. Expand against https://docs.wewire.com/ */

export type WewireEnvironment = "sandbox" | "production";

export type SubCustomerType = "INDIVIDUAL" | "BUSINESS";

export interface WewireWallet {
  id: string;
  balance: string;
  status: "ACTIVE" | "SUSPENDED";
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
  onboardingStatus?: string;
  status?: string;
}

export interface CreateSubCustomerInput {
  type: SubCustomerType;
  email: string;
  country: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  businessType?: "GENERAL_BUSINESS" | "SOLE_PROPRIETORSHIP";
  purpose?: string[];
}
