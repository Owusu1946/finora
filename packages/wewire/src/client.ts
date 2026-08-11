import type {
  BeneficialOwnerInput,
  ConversionPreview,
  ConversionPreviewInput,
  CreateSubCustomerInput,
  FxRate,
  InitiatePayoutInput,
  InternalTransferInput,
  KycLinkResponse,
  KycRequirement,
  MobileMoneyDisbursementInput,
  SubmitKycInput,
  WewireEnvironment,
  WewireSubCustomer,
  WewireTransaction,
  WewireWallet,
} from './types';

const BASE_URLS: Record<WewireEnvironment, string> = {
  sandbox: 'https://stage-capi.wewireafrica.com',
  production: 'https://capi.wewire.com',
};

export interface WewireClientOptions {
  apiKey: string;
  environment?: WewireEnvironment;
  fetch?: typeof fetch;
}

/**
 * Typed WeWire HTTP client (server-only).
 * Finora API uses this; mobile/MCP never import it.
 */
export class WewireClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: WewireClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = BASE_URLS[options.environment ?? 'sandbox'];
    this.fetchFn = options.fetch ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'ww-api-key': this.apiKey,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WeWire ${response.status}: ${body}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // ─── Wallets ─────────────────────────────────────────────────────────────

  listBusinessWallets() {
    return this.request<WewireWallet[]>('/v1/wallets');
  }

  listSubCustomerWallets(subCustomerId: string) {
    return this.request<WewireWallet[]>(`/v1/subcustomers/${subCustomerId}/wallets`);
  }

  // ─── Sub-customers ───────────────────────────────────────────────────────

  createSubCustomer(input: CreateSubCustomerInput) {
    return this.request<WewireSubCustomer>('/v1/subcustomers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listSubCustomers() {
    return this.request<WewireSubCustomer[]>('/v1/subcustomers');
  }

  getSubCustomer(subCustomerId: string) {
    return this.request<WewireSubCustomer>(`/v1/subcustomers/${subCustomerId}`);
  }

  archiveSubCustomer(subCustomerId: string) {
    return this.request<WewireSubCustomer>(`/v1/subcustomers/${subCustomerId}/archive`, {
      method: 'PATCH',
    });
  }

  // ─── KYC ─────────────────────────────────────────────────────────────────

  submitSubCustomerKyc(subCustomerId: string, input: SubmitKycInput) {
    return this.request<{ status: string }>(`/v1/subcustomers/${subCustomerId}/kyc`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getSubCustomerKycLink(subCustomerId: string) {
    return this.request<KycLinkResponse>(`/v1/subcustomers/${subCustomerId}/kyc-link`);
  }

  getKycRequirements(subCustomerId: string) {
    return this.request<KycRequirement[]>(`/v1/subcustomers/${subCustomerId}/kyc/requirements`);
  }

  addBeneficialOwner(subCustomerId: string, input: BeneficialOwnerInput) {
    return this.request<{ id: string }>(`/v1/subcustomers/${subCustomerId}/kyc/beneficial-owners`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  submitKycForReview(subCustomerId: string) {
    return this.request<{ status: string }>(`/v1/subcustomers/${subCustomerId}/kyc/submit`, {
      method: 'POST',
    });
  }

  // ─── Payouts ─────────────────────────────────────────────────────────────

  initiatePayout(input: InitiatePayoutInput) {
    return this.request<WewireTransaction>('/v1/transactions/initiate-payout', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ─── Transactions ────────────────────────────────────────────────────────

  listTransactions(query?: { subCustomerId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (query?.subCustomerId) params.set('subCustomerId', query.subCustomerId);
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return this.request<WewireTransaction[]>(`/v1/transactions${qs ? `?${qs}` : ''}`);
  }

  getTransaction(transactionId: string) {
    return this.request<WewireTransaction>(`/v1/transactions/${transactionId}`);
  }

  // ─── Internal transfers ──────────────────────────────────────────────────

  transfer(subCustomerId: string, input: InternalTransferInput) {
    return this.request<WewireTransaction>(`/v1/subcustomers/${subCustomerId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // ─── MoMo disbursements ──────────────────────────────────────────────────

  disburseMobileMoney(subCustomerId: string, input: MobileMoneyDisbursementInput) {
    return this.request<WewireTransaction>(
      `/v1/subcustomers/${subCustomerId}/disbursements/mobile-money`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  // ─── FX ──────────────────────────────────────────────────────────────────

  listRates() {
    return this.request<FxRate[]>('/v1/rates');
  }

  getPairRate(from: string, to: string) {
    return this.request<FxRate>(`/v1/rates/${from}/${to}`);
  }

  previewConversion(input: ConversionPreviewInput) {
    return this.request<ConversionPreview>('/v1/conversions/preview', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  executeConversion(quoteId: string) {
    return this.request<WewireTransaction>('/v1/conversions/execute', {
      method: 'POST',
      body: JSON.stringify({ quoteId }),
    });
  }
}
