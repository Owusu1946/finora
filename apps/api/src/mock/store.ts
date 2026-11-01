/**
 * In-memory mock Finora platform data for hackathon / local dev.
 * Swap handlers to call WewireClient when WEWIRE_API_KEY + live mode are set.
 */

const now = () => new Date().toISOString();

export type MockSubCustomer = {
  id: string;
  finoraTag: string;
  type: 'INDIVIDUAL' | 'BUSINESS';
  email: string;
  country: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  walletCurrencies: string[];
  onboardingStatus:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'REQUIRES_ACTION';
  purpose: Array<'PAYMENTS' | 'PAYROLL' | 'TREASURY' | 'MARKETPLACE' | 'OTHER'>;
  createdAt: string;
};

export const mockStore = {
  subcustomers: [
    {
      id: 'sc_personal_001',
      finoraTag: 'kennethowusu',
      type: 'INDIVIDUAL',
      email: 'kenneth@finora.app',
      country: 'GH',
      firstName: 'Kenneth',
      lastName: 'Owusu',
      status: 'ACTIVE',
      walletCurrencies: ['GHS', 'USD', 'USDT'],
      onboardingStatus: 'APPROVED',
      purpose: ['PAYMENTS'],
      createdAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'sc_business_001',
      finoraTag: 'finorademo',
      type: 'BUSINESS',
      email: 'ops@finora.business',
      country: 'GH',
      businessName: 'Finora Demo Ltd',
      status: 'ACTIVE',
      walletCurrencies: ['GHS', 'USD'],
      onboardingStatus: 'IN_PROGRESS',
      purpose: ['PAYMENTS', 'PAYROLL'],
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'sc_personal_002',
      finoraTag: 'okenneth',
      type: 'INDIVIDUAL',
      email: 'okenneth@example.com',
      country: 'GH',
      firstName: 'O. Kenneth',
      lastName: 'Mensah',
      status: 'ACTIVE',
      walletCurrencies: ['GHS', 'USD'],
      onboardingStatus: 'APPROVED',
      purpose: ['PAYMENTS'],
      createdAt: '2026-03-08T10:00:00Z',
    },
    {
      id: 'sc_personal_003',
      finoraTag: 'ama',
      type: 'INDIVIDUAL',
      email: 'ama@example.com',
      country: 'GH',
      firstName: 'Ama',
      lastName: 'Asante',
      status: 'ACTIVE',
      walletCurrencies: ['GHS'],
      onboardingStatus: 'APPROVED',
      purpose: ['PAYMENTS'],
      createdAt: '2026-04-11T10:00:00Z',
    },
  ] as MockSubCustomer[],
  wallets: [
    {
      id: 'w_usd',
      currency: 'USD',
      balance: '1240.50',
      status: 'ACTIVE' as const,
      businessId: 'biz_finora',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: now(),
    },
    {
      id: 'w_ghs',
      currency: 'GHS',
      balance: '8450.00',
      status: 'ACTIVE' as const,
      businessId: 'biz_finora',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: now(),
    },
    {
      id: 'w_usdt',
      currency: 'USDT',
      balance: '320.00',
      status: 'ACTIVE' as const,
      businessId: 'biz_finora',
      subCustomerId: 'sc_personal_001',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: now(),
    },
  ],
  contacts: [
    {
      id: 'c-1',
      name: 'Ama Serwah',
      method: 'ACH',
      identifier: '•••• 4892',
      currency: 'USD',
      favourite: true,
    },
    {
      id: 'c-2',
      name: 'Kwame Mensah',
      method: 'MTN MoMo',
      identifier: '0245550198',
      currency: 'GHS',
      favourite: true,
    },
    {
      id: 'c-9',
      name: 'Ama Boateng',
      method: 'MTN MoMo',
      identifier: '0248891000',
      currency: 'GHS',
      favourite: false,
    },
    {
      id: 'c-3',
      name: 'TechFlow Ltd',
      method: 'FPS',
      identifier: '•••• 0194',
      currency: 'GBP',
      favourite: false,
    },
  ],
  kyc: {
    sc_business_001: {
      requirements: [
        {
          id: 'reg',
          label: 'Certificate of incorporation',
          required: true,
          status: 'uploaded' as const,
        },
        { id: 'addr', label: 'Proof of address', required: true, status: 'missing' as const },
        { id: 'ubo', label: 'Beneficial owners', required: true, status: 'missing' as const },
      ],
      beneficialOwners: [] as { id: string; fullName: string; ownershipPercent: number }[],
    },
  } as Record<
    string,
    {
      requirements: Array<{
        id: string;
        label: string;
        required: boolean;
        status: 'missing' | 'uploaded' | 'verified';
      }>;
      beneficialOwners: Array<{ id: string; fullName: string; ownershipPercent: number }>;
    }
  >,
  fxRates: [
    { from: 'USD', to: 'GHS', rate: 15.5, asOf: now() },
    { from: 'GHS', to: 'USD', rate: 1 / 15.5, asOf: now() },
    { from: 'USD', to: 'EUR', rate: 0.92, asOf: now() },
    { from: 'EUR', to: 'USD', rate: 1 / 0.92, asOf: now() },
    { from: 'USD', to: 'GBP', rate: 0.78, asOf: now() },
    { from: 'GBP', to: 'USD', rate: 1 / 0.78, asOf: now() },
    { from: 'USD', to: 'USDT', rate: 1, asOf: now() },
    { from: 'USDT', to: 'USD', rate: 1, asOf: now() },
  ],
  integrations: [
    { id: 'gmail', name: 'Gmail', status: 'connected' },
    { id: 'calendar', name: 'Google Calendar', status: 'disconnected' },
  ],
  webhooks: [] as Array<{
    id: string;
    url: string;
    eventTypes: string[];
    createdAt: string;
  }>,
  eventSubscriptions: [] as Array<{
    id: string;
    eventTypes: string[];
    createdAt: string;
  }>,
};

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
