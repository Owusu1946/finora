export type VirtualCardNetwork = 'visa' | 'mastercard';
export type VirtualCardCurrency = 'USD' | 'GHS' | 'EUR';
export type VirtualCardStatus = 'active' | 'frozen' | 'cancelled';
export type VirtualCardFilter = 'all' | 'active' | 'frozen';

export type VirtualCard = {
  id: string;
  label: string;
  last4: string;
  network: VirtualCardNetwork;
  currency: VirtualCardCurrency;
  status: VirtualCardStatus;
  spendLimit: number;
  spent: number;
  createdAt: string;
  pan: string;
  expiry: string;
  cvv: string;
};

export type CreateVirtualCardInput = {
  label: string;
  spendLimit: number;
  network?: VirtualCardNetwork;
};

export const MOCK_VIRTUAL_CARDS: VirtualCard[] = [
  {
    id: 'card_netflix',
    label: 'Netflix',
    last4: '4242',
    network: 'visa',
    currency: 'USD',
    status: 'active',
    spendLimit: 50,
    spent: 18.99,
    createdAt: '2026-07-12T10:00:00.000Z',
    pan: '4242424242424242',
    expiry: '08/29',
    cvv: '318',
  },
  {
    id: 'card_meta',
    label: 'Meta ads',
    last4: '1881',
    network: 'mastercard',
    currency: 'USD',
    status: 'active',
    spendLimit: 300,
    spent: 142.5,
    createdAt: '2026-06-03T14:20:00.000Z',
    pan: '5555555555551881',
    expiry: '11/28',
    cvv: '904',
  },
  {
    id: 'card_ops',
    label: 'Operations',
    last4: '9012',
    network: 'visa',
    currency: 'USD',
    status: 'frozen',
    spendLimit: 500,
    spent: 120,
    createdAt: '2026-05-20T09:15:00.000Z',
    pan: '4000000000009012',
    expiry: '03/30',
    cvv: '552',
  },
];

export function formatCardAmount(amount: number, currency: string) {
  const symbol =
    currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GHS' ? 'GHS ' : `${currency} `;
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPanGrouped(pan: string) {
  return pan.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function remainingLimit(card: VirtualCard) {
  return Math.max(0, card.spendLimit - card.spent);
}

export function limitProgress(card: VirtualCard) {
  if (card.spendLimit <= 0) return 0;
  return Math.min(1, card.spent / card.spendLimit);
}
