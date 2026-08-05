export type RegisteredPaymentRequest = {
  preparationId: string;
  amount: number;
  currency: string;
  memo?: string;
  link: string;
  expiresAt?: string;
};

const byId = new Map<string, RegisteredPaymentRequest>();

export function registerPaymentRequest(request: RegisteredPaymentRequest) {
  byId.set(request.preparationId, request);
}

export function getPaymentRequest(
  preparationId: string,
): RegisteredPaymentRequest | null {
  return byId.get(preparationId) ?? null;
}

export function clearPaymentRequests() {
  byId.clear();
}
