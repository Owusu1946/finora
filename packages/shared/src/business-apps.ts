import { z } from 'zod';

/**
 * Business apps connect through Composio and sit beside the native Google
 * integrations (Gmail, Calendar, Drive), which keep their own OAuth flows.
 */
export const BusinessAppCategorySchema = z.enum([
  'get_paid',
  'books',
  'customers',
  'messaging',
  'workspace',
]);
export type BusinessAppCategory = z.infer<typeof BusinessAppCategorySchema>;

export const BUSINESS_APP_CATEGORIES: { id: BusinessAppCategory; title: string }[] = [
  { id: 'get_paid', title: 'Get paid' },
  { id: 'books', title: 'Books and invoices' },
  { id: 'customers', title: 'Customers' },
  { id: 'messaging', title: 'Talk to customers' },
  { id: 'workspace', title: 'Team and ops' },
];

export type CuratedBusinessApp = {
  slug: string;
  name: string;
  category: BusinessAppCategory;
  /** One line for the app list. */
  description: string;
  /** What the assistant should use this app for, and the read actions to start from. */
  guide: string;
};

/**
 * Apps picked for African businesses. Slugs and action names are Composio's;
 * every action named here is read-only.
 */
export const CURATED_BUSINESS_APPS: CuratedBusinessApp[] = [
  {
    slug: 'paystack',
    name: 'Paystack',
    category: 'get_paid',
    description:
      'Card, bank, and mobile money payments in Nigeria, Ghana, Kenya, and South Africa.',
    guide:
      'Source of truth for customer payments, settlements, refunds, disputes, subscriptions, and payment requests (Paystack invoices). Use get_business_payments and get_business_balances for sales and balances. For other reads try PAYSTACK_LIST_SETTLEMENTS, PAYSTACK_LIST_CUSTOMERS, PAYSTACK_LIST_PAYMENT_REQUESTS, PAYSTACK_LIST_REFUNDS, PAYSTACK_LIST_DISPUTES, or PAYSTACK_VERIFY_TRANSACTION.',
  },
  {
    slug: 'flutterwave',
    name: 'Flutterwave',
    category: 'get_paid',
    description: 'Collections across Africa by card, bank transfer, and mobile money.',
    guide:
      'Source of truth for Flutterwave collections and wallet balances. Use get_business_payments and get_business_balances. For other reads try FLUTTERWAVE_GET_TRANSACTION, FLUTTERWAVE_VIEW_TRANSACTION_TIMELINE, or FLUTTERWAVE_GET_ALL_SUBSCRIPTIONS.',
  },
  {
    slug: 'stripe',
    name: 'Stripe',
    category: 'get_paid',
    description: 'Card payments, subscriptions, and invoices from customers abroad.',
    guide:
      'Source of truth for international card payments, Stripe invoices, and subscriptions. Use get_business_payments and get_business_balances. For other reads try STRIPE_LIST_INVOICES, STRIPE_SEARCH_CUSTOMERS, or STRIPE_LIST_SUBSCRIPTIONS.',
  },
  {
    slug: 'quickbooks',
    name: 'QuickBooks',
    category: 'books',
    description: 'Invoices, bills, customers, and receivables.',
    guide:
      'Source of truth for invoices, bills, and who owes the business money. Try QUICKBOOKS_LIST_INVOICES, QUICKBOOKS_GET_AGED_RECEIVABLES_REPORT, QUICKBOOKS_QUERY_BILLS, or QUICKBOOKS_CUSTOMER_BALANCE_REPORT.',
  },
  {
    slug: 'zoho_invoice',
    name: 'Zoho Invoice',
    category: 'books',
    description: 'Invoices, payments received, and expenses.',
    guide:
      'Source of truth for invoices and payments recorded in Zoho. Try ZOHO_INVOICE_LIST_INVOICES, ZOHO_INVOICE_LIST_PAYMENTS, ZOHO_INVOICE_LIST_CONTACTS, or ZOHO_INVOICE_LIST_EXPENSES.',
  },
  {
    slug: 'hubspot',
    name: 'HubSpot',
    category: 'customers',
    description: 'Contacts, companies, and deals in your CRM.',
    guide:
      'Source of truth for customer contacts, companies, and deals in the sales pipeline. Try HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA to find a customer before messaging or matching a payment.',
  },
  {
    slug: 'zoho',
    name: 'Zoho CRM',
    category: 'customers',
    description: 'Leads, contacts, and deals in Zoho CRM.',
    guide: 'Source of truth for leads, contacts, and deals kept in Zoho CRM.',
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp Business',
    category: 'messaging',
    description: 'Message customers from your WhatsApp Business number.',
    guide:
      'How the business talks to customers. Use draft_whatsapp_message for receipts, payment reminders, and replies; the user sends the draft. Free-form messages only reach customers who messaged the business in the last 24 hours.',
  },
  {
    slug: 'slack',
    name: 'Slack',
    category: 'messaging',
    description: 'Your team chat.',
    guide:
      'Where the team talks. Read channels and messages for context on payments and approvals.',
  },
  {
    slug: 'googlesheets',
    name: 'Google Sheets',
    category: 'workspace',
    description: 'Sales logs, stock lists, and any business spreadsheet.',
    guide:
      'Many businesses keep sales, stock, and debtor lists in spreadsheets. Search for the sheet, then read the values.',
  },
  {
    slug: 'notion',
    name: 'Notion',
    category: 'workspace',
    description: 'Docs, wikis, and team databases.',
    guide: 'Team docs and databases, such as supplier lists and price sheets.',
  },
  {
    slug: 'airtable',
    name: 'Airtable',
    category: 'workspace',
    description: 'Orders, inventory, and records in Airtable bases.',
    guide: 'Orders, inventory, and other records kept in Airtable bases.',
  },
];

export function curatedBusinessApp(slug: string) {
  return CURATED_BUSINESS_APPS.find((app) => app.slug === slug);
}

export const BusinessAppConnectionStatusSchema = z.enum([
  'connected',
  'pending',
  'error',
  'disconnected',
]);
export type BusinessAppConnectionStatus = z.infer<typeof BusinessAppConnectionStatusSchema>;

export const BusinessAppSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  logo: z.url().nullable(),
  description: z.string(),
  category: BusinessAppCategorySchema.nullable(),
  status: BusinessAppConnectionStatusSchema,
  /** False for apps Finora can't connect yet (they need their own OAuth app). */
  connectable: z.boolean(),
});
export type BusinessApp = z.infer<typeof BusinessAppSchema>;

export const BusinessAppListResponseSchema = z.object({
  apps: z.array(BusinessAppSchema),
});

export const BrowseBusinessAppsResponseSchema = z.object({
  apps: z.array(BusinessAppSchema),
  nextCursor: z.string().nullable(),
});

export const ConnectBusinessAppRequestSchema = z.object({
  returnUrl: z.string().min(1).max(2_048),
});

export const ConnectBusinessAppResponseSchema = z.object({
  url: z.url(),
});

/** E.164 without the plus sign is what WhatsApp expects; accept either. */
const WhatsAppNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Use the full international number, e.g. +233241234567');

export const SendWhatsAppMessageRequestSchema = z.object({
  to: WhatsAppNumberSchema,
  text: z.string().trim().min(1).max(1_000),
});
export type SendWhatsAppMessageRequest = z.infer<typeof SendWhatsAppMessageRequestSchema>;

/** A payment a customer made through a connected payment app, in major units. */
export const BusinessPaymentSchema = z.object({
  app: z.string(),
  id: z.string(),
  reference: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['successful', 'failed', 'pending', 'refunded', 'other']),
  customer: z.string().nullable(),
  channel: z.string().nullable(),
  paidAt: z.string().nullable(),
});
export type BusinessPayment = z.infer<typeof BusinessPaymentSchema>;

export const BusinessBalanceSchema = z.object({
  app: z.string(),
  currency: z.string(),
  available: z.number(),
  pending: z.number().nullable(),
});
export type BusinessBalance = z.infer<typeof BusinessBalanceSchema>;

export const PAYMENT_APP_SLUGS = ['paystack', 'flutterwave', 'stripe'] as const;

export const GetBusinessPaymentsToolInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .describe('How many days back to look. "Today" is 1, "this week" is 7, "this month" is 30.'),
  app: z
    .enum(PAYMENT_APP_SLUGS)
    .optional()
    .describe('Only one payment app. Omit to combine every connected payment app.'),
  status: z
    .enum(['successful', 'failed', 'all'])
    .optional()
    .describe('Defaults to successful, which is money actually received.'),
});

export const GetBusinessBalancesToolInputSchema = z.object({});

export const FindAppActionsToolInputSchema = z.object({
  app: z.string().trim().min(1).describe('App slug from the connected apps list, e.g. quickbooks'),
  query: z.string().trim().min(2).max(120).describe('What you need, e.g. "unpaid invoices"'),
});

export const RunAppActionToolInputSchema = z.object({
  action: z
    .string()
    .regex(/^[A-Z0-9_]+$/)
    .describe(
      'Exact action name from find_app_actions or the app guide, e.g. QUICKBOOKS_LIST_INVOICES',
    ),
  arguments: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Arguments matching the action's input schema"),
});

export const DraftWhatsAppMessageToolInputSchema = z.object({
  to: WhatsAppNumberSchema.describe('Customer number in international format'),
  text: z.string().trim().min(1).max(1_000),
  customerName: z.string().trim().max(80).optional(),
  purpose: z
    .enum(['receipt', 'payment_reminder', 'reply', 'other'])
    .optional()
    .describe('Why the message is being sent'),
});

export const SuggestAppConnectionToolInputSchema = z.object({
  app: z.string().trim().min(1).describe('App slug, e.g. paystack'),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .describe('One sentence on what connecting it lets Finora do for this request'),
});

/**
 * Attached to a tool result when the tool needs an app the user hasn't
 * connected. The chat renders a Connect card for each option, so the user can
 * connect without leaving the conversation.
 */
export const AppConnectOptionSchema = z.object({
  /** Composio slug, or gmail / googledrive / googlecalendar for the native Google apps. */
  app: z.string().min(1),
  name: z.string().min(1),
  logo: z.string().nullable(),
  kind: z.enum(['business', 'google']),
  /** False when Finora can't connect this app yet. */
  connectable: z.boolean(),
});
export type AppConnectOption = z.infer<typeof AppConnectOptionSchema>;

export const GOOGLE_CONNECT_OPTIONS = {
  gmail: { app: 'gmail', name: 'Gmail', logo: null, kind: 'google', connectable: true },
  googledrive: {
    app: 'googledrive',
    name: 'Google Drive',
    logo: null,
    kind: 'google',
    connectable: true,
  },
  googlecalendar: {
    app: 'googlecalendar',
    name: 'Google Calendar',
    logo: null,
    kind: 'google',
    connectable: true,
  },
} satisfies Record<string, AppConnectOption>;
