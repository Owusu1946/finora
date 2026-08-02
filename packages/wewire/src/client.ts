import type {
  CreateSubCustomerInput,
  WewireEnvironment,
  WewireSubCustomer,
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

  listBusinessWallets() {
    return this.request<WewireWallet[]>('/v1/wallets');
  }

  listSubCustomerWallets(subCustomerId: string) {
    return this.request<WewireWallet[]>(`/v1/subcustomers/${subCustomerId}/wallets`);
  }

  createSubCustomer(input: CreateSubCustomerInput) {
    return this.request<WewireSubCustomer>('/v1/subcustomers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  getSubCustomer(subCustomerId: string) {
    return this.request<WewireSubCustomer>(`/v1/subcustomers/${subCustomerId}`);
  }
}
