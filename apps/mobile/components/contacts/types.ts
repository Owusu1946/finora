import type { SupportedCurrency } from '@/components/ui/currency-icon';

export interface Contact {
  id: string;
  name: string;
  /** Two-letter initials for avatar fallback */
  initials: string;
  /** Primary currency used with this contact */
  currency: SupportedCurrency;
  /** Payment method or network */
  method: string;
  /** Masked identifier (phone, address, account) */
  identifier: string;
  /** Whether this contact is marked as a favourite */
  favourite: boolean;
  /** ISO timestamp of last transaction */
  lastTxDate: string | null;
}

export type ContactFilter = 'all' | 'favourites' | 'recent';

/** Avatar background colors — deterministic by index. */
export const AVATAR_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#0EA5E9', // sky
  '#F97316', // orange
  '#14B8A6', // teal
];
