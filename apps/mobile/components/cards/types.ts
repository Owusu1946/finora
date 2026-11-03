export type VirtualCardNetwork = 'visa' | 'mastercard';
export type VirtualCardCurrency = 'USD' | 'GHS' | 'EUR' | 'GBP';
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
  currency?: VirtualCardCurrency;
  network?: VirtualCardNetwork;
};

export function formatCardAmount(amount: number, currency: string) {
  const symbol =
    currency === 'USD'
      ? '$'
      : currency === 'EUR'
        ? '€'
        : currency === 'GHS'
          ? 'GHS '
          : `${currency} `;
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
