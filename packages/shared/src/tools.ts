import { z } from 'zod';

import {
  BlockchainNetworkSchema,
  CurrencySchema,
  DestinationKindSchema,
  InvoiceStatusSchema,
  MobileMoneyNetworkSchema,
  MoneyAmountSchema,
  PurposeCodeSchema,
  RecurringFrequencySchema,
  RecurringStatusSchema,
  SubCustomerOnboardingStatusSchema,
  SubCustomerPurposeSchema,
  SubCustomerStatusSchema,
  SubCustomerTypeSchema,
  WalletTransactionChannelSchema,
  WalletTransactionStatusSchema,
  WalletTransactionTypeSchema,
} from './enums';

/**
 * Finora MCP / API tool contracts.
 * Money-moving tools prepare work → Approval Engine → human confirms in app.
 * Execution never happens inside an MCP tool call.
 */

// ─── Catalog ───────────────────────────────────────────────────────────────

export const TOOL_NAMES = [
  // Health
  'ping',

  // Balances / wallets / receive
  'get_balances',
  'list_wallets',
  'list_receive_methods',
  'list_virtual_accounts',
  'list_crypto_addresses',

  // Contacts
  'search_contacts',
  'list_contacts',
  'save_contact',
  'lookup_account',

  // Payments (prepare → approval)
  'prepare_payment',
  'prepare_momo_disbursement',
  'prepare_internal_transfer',
  'prepare_conversion',

  // Approvals (agent creates / lists; human approves in app)
  'list_approvals',
  'get_approval',
  'request_approval',

  // Transactions
  'list_transactions',
  'get_transaction',

  // FX
  'list_fx_rates',
  'get_fx_rate',
  'preview_conversion',

  // Sub-customers
  'create_subcustomer',
  'list_subcustomers',
  'get_subcustomer',
  'archive_subcustomer',

  // KYC
  'submit_subcustomer_kyc',
  'get_subcustomer_kyc_link',
  'get_kyc_requirements',
  'add_beneficial_owner',
  'submit_kyc_for_review',

  // Invoices / Gmail
  'list_invoices',
  'get_invoice',
  'prepare_invoice_payment',

  // Recurring / scheduled
  'prepare_recurring_payment',
  'list_recurring_payments',
  'update_recurring_payment',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

// ─── Common ────────────────────────────────────────────────────────────────

export const PingInputSchema = z
  .object({
    message: z.string().optional(),
  })
  .strict();

export const GetBalancesInputSchema = z.object({}).strict();

export const ListWalletsInputSchema = z
  .object({
    subCustomerId: z.string().optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const ListReceiveMethodsInputSchema = z
  .object({
    currency: CurrencySchema.optional(),
    prefer: z.enum(['virtual_account', 'mobile_money', 'crypto']).optional(),
  })
  .strict();

export const ListVirtualAccountsInputSchema = z
  .object({
    currency: CurrencySchema.optional(),
  })
  .strict();

export const ListCryptoAddressesInputSchema = z
  .object({
    currency: CurrencySchema.optional(),
    network: BlockchainNetworkSchema.optional(),
  })
  .strict();

// ─── Contacts ──────────────────────────────────────────────────────────────

export const SearchContactsInputSchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

export const ListContactsInputSchema = z
  .object({
    favouriteOnly: z.boolean().optional(),
  })
  .strict();

export const SaveContactInputSchema = z
  .object({
    name: z.string().min(1),
    method: z.string().min(1),
    identifier: z.string().min(1),
    currency: CurrencySchema.optional(),
    favourite: z.boolean().optional(),
  })
  .strict();

export const LookupAccountInputSchema = z
  .object({
    kind: DestinationKindSchema,
    value: z.string().min(1),
    network: MobileMoneyNetworkSchema.optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

// ─── Payments ──────────────────────────────────────────────────────────────

export const PreparePaymentInputSchema = z
  .object({
    contactId: z.string().optional(),
    recipientName: z.string().optional(),
    amount: MoneyAmountSchema,
    destinationKind: DestinationKindSchema.optional(),
    destinationLabel: z.string().optional(),
    destinationValue: z.string().optional(),
    purposeCode: PurposeCodeSchema.optional(),
    reference: z.string().max(140).optional(),
    description: z.string().max(280).optional(),
    subCustomerId: z.string().optional(),
  })
  .strict();

export const PrepareMomoDisbursementInputSchema = z
  .object({
    subCustomerId: z.string().optional(),
    amount: MoneyAmountSchema,
    network: MobileMoneyNetworkSchema,
    phoneNumber: z.string().min(7),
    recipientName: z.string().optional(),
    reference: z.string().max(140).optional(),
  })
  .strict();

export const PrepareInternalTransferInputSchema = z
  .object({
    fromSubCustomerId: z.string(),
    toSubCustomerId: z.string(),
    amount: MoneyAmountSchema,
    reference: z.string().max(140).optional(),
  })
  .strict();

export const PrepareConversionInputSchema = z
  .object({
    from: CurrencySchema,
    to: CurrencySchema,
    amount: z.number().positive(),
    subCustomerId: z.string().optional(),
  })
  .strict();

// ─── Approvals ─────────────────────────────────────────────────────────────

export const ListApprovalsInputSchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected', 'all']).optional(),
  })
  .strict();

export const GetApprovalInputSchema = z
  .object({
    approvalId: z.string().min(1),
  })
  .strict();

export const RequestApprovalInputSchema = z
  .object({
    preparationId: z.string().min(1),
    note: z.string().max(280).optional(),
  })
  .strict();

// ─── Transactions ──────────────────────────────────────────────────────────

export const ListTransactionsInputSchema = z
  .object({
    subCustomerId: z.string().optional(),
    type: WalletTransactionTypeSchema.optional(),
    channel: WalletTransactionChannelSchema.optional(),
    status: WalletTransactionStatusSchema.optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

export const GetTransactionInputSchema = z
  .object({
    transactionId: z.string().min(1),
  })
  .strict();

// ─── FX ────────────────────────────────────────────────────────────────────

export const ListFxRatesInputSchema = z.object({}).strict();

export const GetFxRateInputSchema = z
  .object({
    from: CurrencySchema,
    to: CurrencySchema,
  })
  .strict();

export const PreviewConversionInputSchema = PrepareConversionInputSchema;

// ─── Sub-customers ─────────────────────────────────────────────────────────

export const CreateSubCustomerInputSchema = z
  .object({
    type: SubCustomerTypeSchema,
    email: z.string().email(),
    country: z.string().length(2),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    businessName: z.string().optional(),
    purpose: z.array(SubCustomerPurposeSchema).optional(),
  })
  .strict();

export const ListSubCustomersInputSchema = z
  .object({
    status: SubCustomerStatusSchema.optional(),
    type: SubCustomerTypeSchema.optional(),
  })
  .strict();

export const GetSubCustomerInputSchema = z
  .object({
    subCustomerId: z.string().min(1),
  })
  .strict();

export const ArchiveSubCustomerInputSchema = GetSubCustomerInputSchema;

// ─── KYC ───────────────────────────────────────────────────────────────────

export const SubmitSubCustomerKycInputSchema = z
  .object({
    subCustomerId: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().length(2).optional(),
    idType: z.string().optional(),
    idNumber: z.string().optional(),
  })
  .strict();

export const GetSubCustomerKycLinkInputSchema = GetSubCustomerInputSchema;

export const GetKycRequirementsInputSchema = z
  .object({
    subCustomerId: z.string().min(1),
    type: SubCustomerTypeSchema.optional(),
  })
  .strict();

export const AddBeneficialOwnerInputSchema = z
  .object({
    subCustomerId: z.string().min(1),
    fullName: z.string().min(1),
    ownershipPercent: z.number().positive().max(100),
    nationality: z.string().length(2).optional(),
  })
  .strict();

export const SubmitKycForReviewInputSchema = GetSubCustomerInputSchema;

// ─── Invoices ──────────────────────────────────────────────────────────────

export const ListInvoicesInputSchema = z
  .object({
    status: InvoiceStatusSchema.or(z.literal('all')).optional(),
    source: z.enum(['gmail', 'manual', 'agent', 'all']).optional(),
  })
  .strict();

export const GetInvoiceInputSchema = z
  .object({
    invoiceId: z.string().min(1),
  })
  .strict();

export const PrepareInvoicePaymentInputSchema = z
  .object({
    invoiceId: z.string().min(1),
  })
  .strict();

// ─── Recurring ─────────────────────────────────────────────────────────────

export const PrepareRecurringPaymentInputSchema = z
  .object({
    recipientName: z.string().min(1),
    amount: MoneyAmountSchema,
    frequency: RecurringFrequencySchema,
    destinationKind: DestinationKindSchema,
    destinationLabel: z.string().optional(),
    destinationValue: z.string().min(1),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    timeOfDay: z.string().optional(),
    reference: z.string().max(140).optional(),
    purpose: z.string().optional(),
  })
  .strict();

export const ListRecurringPaymentsInputSchema = z
  .object({
    status: RecurringStatusSchema.or(z.literal('all')).optional(),
  })
  .strict();

export const UpdateRecurringPaymentInputSchema = z
  .object({
    recurringId: z.string().min(1),
    status: RecurringStatusSchema,
  })
  .strict();

/** Map tool name → Zod input schema (for MCP registration / docs). */
export const TOOL_INPUT_SCHEMAS = {
  ping: PingInputSchema,
  get_balances: GetBalancesInputSchema,
  list_wallets: ListWalletsInputSchema,
  list_receive_methods: ListReceiveMethodsInputSchema,
  list_virtual_accounts: ListVirtualAccountsInputSchema,
  list_crypto_addresses: ListCryptoAddressesInputSchema,
  search_contacts: SearchContactsInputSchema,
  list_contacts: ListContactsInputSchema,
  save_contact: SaveContactInputSchema,
  lookup_account: LookupAccountInputSchema,
  prepare_payment: PreparePaymentInputSchema,
  prepare_momo_disbursement: PrepareMomoDisbursementInputSchema,
  prepare_internal_transfer: PrepareInternalTransferInputSchema,
  prepare_conversion: PrepareConversionInputSchema,
  list_approvals: ListApprovalsInputSchema,
  get_approval: GetApprovalInputSchema,
  request_approval: RequestApprovalInputSchema,
  list_transactions: ListTransactionsInputSchema,
  get_transaction: GetTransactionInputSchema,
  list_fx_rates: ListFxRatesInputSchema,
  get_fx_rate: GetFxRateInputSchema,
  preview_conversion: PreviewConversionInputSchema,
  create_subcustomer: CreateSubCustomerInputSchema,
  list_subcustomers: ListSubCustomersInputSchema,
  get_subcustomer: GetSubCustomerInputSchema,
  archive_subcustomer: ArchiveSubCustomerInputSchema,
  submit_subcustomer_kyc: SubmitSubCustomerKycInputSchema,
  get_subcustomer_kyc_link: GetSubCustomerKycLinkInputSchema,
  get_kyc_requirements: GetKycRequirementsInputSchema,
  add_beneficial_owner: AddBeneficialOwnerInputSchema,
  submit_kyc_for_review: SubmitKycForReviewInputSchema,
  list_invoices: ListInvoicesInputSchema,
  get_invoice: GetInvoiceInputSchema,
  prepare_invoice_payment: PrepareInvoicePaymentInputSchema,
  prepare_recurring_payment: PrepareRecurringPaymentInputSchema,
  list_recurring_payments: ListRecurringPaymentsInputSchema,
  update_recurring_payment: UpdateRecurringPaymentInputSchema,
} as const satisfies Record<ToolName, z.ZodTypeAny>;
