import type { SupportedCurrency } from "@/components/ui/currency-icon";

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

export type ContactFilter = "all" | "favourites" | "recent";

/** Avatar background colors — deterministic by index. */
export const AVATAR_COLORS = [
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F59E0B", // amber
  "#10B981", // emerald
  "#0EA5E9", // sky
  "#F97316", // orange
  "#14B8A6", // teal
];

export const MOCK_CONTACTS: Contact[] = [
  {
    id: "c-1",
    name: "Ama Serwah",
    initials: "AS",
    currency: "USD",
    method: "ACH",
    identifier: "•••• 4892",
    favourite: true,
    lastTxDate: "2026-08-02T09:14:00Z",
  },
  {
    id: "c-2",
    name: "Kwame Mensah",
    initials: "KM",
    currency: "GHS",
    method: "MTN MoMo",
    identifier: "+233 •• ••• 0192",
    favourite: true,
    lastTxDate: "2026-08-01T15:08:00Z",
  },
  {
    id: "c-3",
    name: "TechFlow Ltd",
    initials: "TF",
    currency: "GBP",
    method: "FPS",
    identifier: "•••• 0194",
    favourite: false,
    lastTxDate: "2026-08-01T11:20:00Z",
  },
  {
    id: "c-4",
    name: "Maria García",
    initials: "MG",
    currency: "EUR",
    method: "SEPA",
    identifier: "GB82 •••• 8291",
    favourite: false,
    lastTxDate: "2026-07-30T08:12:00Z",
  },
  {
    id: "c-5",
    name: "ClearView Partners",
    initials: "CP",
    currency: "GBP",
    method: "SWIFT",
    identifier: "BARCGB22",
    favourite: false,
    lastTxDate: "2026-07-28T13:18:00Z",
  },
  {
    id: "c-6",
    name: "Abena Owusu",
    initials: "AO",
    currency: "USD",
    method: "ACH",
    identifier: "•••• 7721",
    favourite: true,
    lastTxDate: "2026-07-29T10:05:00Z",
  },
  {
    id: "c-7",
    name: "Daniel Adjei",
    initials: "DA",
    currency: "GHS",
    method: "Telecel MoMo",
    identifier: "+233 •• ••• 4410",
    favourite: false,
    lastTxDate: null,
  },
  {
    id: "c-8",
    name: "Yuki Tanaka",
    initials: "YT",
    currency: "USDT",
    method: "TRC-20",
    identifier: "TY9a…0hA1",
    favourite: false,
    lastTxDate: null,
  },
];
