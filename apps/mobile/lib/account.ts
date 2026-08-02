export type AccountType = "personal" | "business";

/**
 * Placeholder until Clerk + onboarding persist the real selection.
 * Swap this for API/user state later.
 */
let currentAccountType: AccountType = "personal";

export function getAccountType(): AccountType {
  return currentAccountType;
}

/** Dev/testing helper — onboarding will set this for real. */
export function setAccountType(type: AccountType) {
  currentAccountType = type;
}

export function getAccountLabel(type: AccountType = getAccountType()): string {
  return type === "business" ? "Business" : "Personal";
}

export function getAccountFullLabel(type: AccountType = getAccountType()): string {
  return type === "business" ? "Business Account" : "Personal Account";
}
