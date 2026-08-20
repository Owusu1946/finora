import { z } from 'zod';

import {
  BlockchainNetworkSchema,
  CurrencySchema,
  DestinationKindSchema,
  FxQuoteSchema,
  InvoiceStatusSchema,
  MobileMoneyNetworkSchema,
  MoneyAmountSchema,
  PurposeCodeSchema,
  RecurringFrequencySchema,
  RecurringStatusSchema,
  SettlementMethodSchema,
  SubCustomerPurposeSchema,
  SubCustomerStatusSchema,
  SubCustomerTypeSchema,
  WalletTransactionChannelSchema,
  WalletTransactionStatusSchema,
  WalletTransactionTypeSchema,
} from './enums';
import { FinoraTagSchema } from './finora-tag';
import { type McpRegistryToolName, type RegistryToolName } from './registry';

/**
 * Zod input contracts for platform / MCP tools.
 * Money-moving tools prepare work → Approval Engine → human confirms in app.
 * MCP never receives execute_* schemas for settlement.
 */

export type ToolName = RegistryToolName;

export const EmptyInputSchema = z.object({}).strict();

export const PingInputSchema = z
  .object({
    message: z.string().optional(),
  })
  .strict();

export const IdInputSchema = z.object({ id: z.string().min(1) }).strict();

export const GetBalancesInputSchema = EmptyInputSchema;

export const GetGmailStatusInputSchema = EmptyInputSchema;

export const ListCalendarDuesInputSchema = z
  .object({
    range: z.enum(['week', 'month', 'six_months']).default('month'),
    query: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const GmailSearchFieldsSchema = z
  .object({
    keywords: z.string().trim().min(1).max(200).optional(),
    from: z.string().trim().min(1).max(200).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    hasAttachment: z.boolean().optional(),
    invoiceOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(20).default(10),
    cursor: z.string().min(1).max(1_000).optional(),
  })
  .strict();

export const SearchGmailMessagesInputSchema = GmailSearchFieldsSchema.refine(
  (value) => value.keywords || value.from || value.startDate || value.endDate || value.invoiceOnly,
  {
    message: 'At least one Gmail search filter is required.',
  },
);

export const GetGmailMessageInputSchema = z
  .object({ messageId: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/) })
  .strict();

export const SearchDriveFilesInputSchema = z
  .object({ query: z.string().trim().min(1).max(200) })
  .strict();
export const GetDriveFileInputSchema = z.object({ fileId: z.string().min(1).max(200) }).strict();

export const FindGmailInvoicesInputSchema = GmailSearchFieldsSchema.extend({
  invoiceOnly: z.literal(true).default(true),
});

export const ListWalletsInputSchema = z
  .object({
    subCustomerId: z.string().optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const GetWalletInputSchema = z
  .object({
    walletId: z.string().min(1),
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

export const GetVirtualAccountInputSchema = z
  .object({
    virtualAccountId: z.string().min(1),
  })
  .strict();

export const ListCryptoAddressesInputSchema = z
  .object({
    currency: CurrencySchema.optional(),
    network: BlockchainNetworkSchema.optional(),
  })
  .strict();

export const GetCryptoWalletInputSchema = z
  .object({
    walletId: z.string().optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const ValidateWalletAddressInputSchema = z
  .object({
    address: z.string().min(1),
    network: BlockchainNetworkSchema.optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

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

export const CreateContactInputSchema = SaveContactInputSchema;

export const LookupAccountInputSchema = z
  .object({
    kind: DestinationKindSchema,
    value: z.string().min(1),
    network: MobileMoneyNetworkSchema.optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const LookupFinoraTagInputSchema = z
  .object({
    tag: FinoraTagSchema,
  })
  .strict();

export const LookupBankAccountInputSchema = z
  .object({
    accountNumber: z.string().min(1),
    bankCode: z.string().optional(),
    country: z.string().length(2).optional(),
  })
  .strict();

export const LookupMobileMoneyInputSchema = z
  .object({
    phoneNumber: z.string().min(7),
    network: MobileMoneyNetworkSchema.optional(),
  })
  .strict();

export const LookupCryptoRecipientInputSchema = z
  .object({
    address: z.string().min(1),
    network: BlockchainNetworkSchema.optional(),
  })
  .strict();

export const ResolveRecipientInputSchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

export const ResolveDuplicateRecipientsInputSchema = ResolveRecipientInputSchema;
export const SearchRecipientInputSchema = ResolveRecipientInputSchema;

export const PreviewPaymentInputSchema = z
  .object({
    amount: MoneyAmountSchema,
    destinationKind: DestinationKindSchema.optional(),
    destinationValue: z.string().optional(),
    contactId: z.string().optional(),
  })
  .strict();

export const PreparePaymentInputSchema = z
  .object({
    contactId: z.string().optional(),
    recipientName: z.string().optional(),
    amount: MoneyAmountSchema,
    destinationKind: DestinationKindSchema.optional(),
    destinationLabel: z.string().optional(),
    destinationValue: z.string().optional(),
    destinationCountry: z.string().length(2).optional(),
    settlementMethod: SettlementMethodSchema.optional(),
    fundingCurrency: CurrencySchema.optional(),
    purposeCode: PurposeCodeSchema.optional(),
    reference: z.string().max(140).optional(),
    description: z.string().max(280).optional(),
    subCustomerId: z.string().optional(),
    /** Rail-specific fields (only those required for settlementMethod). */
    iban: z.string().optional(),
    swiftBic: z.string().optional(),
    sortCode: z.string().optional(),
    routingNumber: z.string().optional(),
    accountNumber: z.string().optional(),
    accountCategory: z.enum(['CHECKING', 'SAVINGS']).optional(),
    network: MobileMoneyNetworkSchema.optional(),
    accountName: z.string().optional(),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    fx: FxQuoteSchema.optional(),
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

export const PrepareBankTransferInputSchema = z
  .object({
    amount: MoneyAmountSchema,
    accountNumber: z.string().min(1),
    bankCode: z.string().optional(),
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

export const PrepareWalletTransferInputSchema = z
  .object({
    fromWalletId: z.string().min(1),
    toWalletId: z.string().min(1),
    amount: MoneyAmountSchema,
    reference: z.string().max(140).optional(),
  })
  .strict();

export const PrepareUsdtTransferInputSchema = z
  .object({
    amount: z.number().positive(),
    address: z.string().min(1),
    network: BlockchainNetworkSchema.optional(),
    reference: z.string().max(140).optional(),
  })
  .strict();

export const PrepareUsdcTransferInputSchema = PrepareUsdtTransferInputSchema;

export const PrepareConversionInputSchema = z
  .object({
    from: CurrencySchema,
    to: CurrencySchema,
    amount: z.number().positive(),
    subCustomerId: z.string().optional(),
  })
  .strict();

export const CancelPreparationInputSchema = z
  .object({
    preparationId: z.string().min(1),
  })
  .strict();

export const EstimateFeesInputSchema = PreviewPaymentInputSchema;
export const EstimateDeliveryTimeInputSchema = PreviewPaymentInputSchema;
export const EstimateNetworkFeeInputSchema = PrepareUsdtTransferInputSchema;

export const VerifyBankAccountInputSchema = LookupBankAccountInputSchema;
export const VerifyMobileMoneyInputSchema = LookupMobileMoneyInputSchema;
export const ListSupportedBanksInputSchema = z
  .object({
    country: z.string().length(2).optional(),
  })
  .strict();
export const ListMomoNetworksInputSchema = EmptyInputSchema;
export const ListSupportedCurrenciesInputSchema = EmptyInputSchema;
export const GetWalletLimitsInputSchema = z
  .object({
    walletId: z.string().optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

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

export const CreateApprovalRequestInputSchema = z
  .object({
    preparationId: z.string().min(1),
    agent: z.string().optional(),
    note: z.string().max(280).optional(),
  })
  .strict();

export const ListTransactionsInputSchema = z
  .object({
    subCustomerId: z.string().optional(),
    type: WalletTransactionTypeSchema.optional(),
    channel: WalletTransactionChannelSchema.optional(),
    status: WalletTransactionStatusSchema.optional(),
    query: z.string().optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

export const GetTransactionInputSchema = z
  .object({
    transactionId: z.string().min(1),
  })
  .strict();

export const SearchTransactionsInputSchema = z
  .object({
    query: z.string().min(1),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

export const FilterTransactionsInputSchema = ListTransactionsInputSchema;

export const ListFxRatesInputSchema = EmptyInputSchema;

export const GetFxRateInputSchema = z
  .object({
    from: CurrencySchema,
    to: CurrencySchema,
  })
  .strict();

export const PreviewConversionInputSchema = PrepareConversionInputSchema;

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

export const CreateFinancialAccountInputSchema = CreateSubCustomerInputSchema;

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

export const GetFinancialAccountInputSchema = GetSubCustomerInputSchema;
export const ArchiveSubCustomerInputSchema = GetSubCustomerInputSchema;

export const StartKycInputSchema = GetSubCustomerInputSchema;

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

export const SubmitKycInputSchema = SubmitSubCustomerKycInputSchema;
export const GetKycStatusInputSchema = GetSubCustomerInputSchema;
export const GetSubCustomerKycLinkInputSchema = GetSubCustomerInputSchema;
export const GetKycLinkInputSchema = GetSubCustomerInputSchema;

export const GetKycRequirementsInputSchema = z
  .object({
    subCustomerId: z.string().min(1),
    type: SubCustomerTypeSchema.optional(),
  })
  .strict();

export const ListKycRequirementsInputSchema = GetKycRequirementsInputSchema;

export const AddBeneficialOwnerInputSchema = z
  .object({
    subCustomerId: z.string().min(1),
    fullName: z.string().min(1),
    ownershipPercent: z.number().positive().max(100),
    nationality: z.string().length(2).optional(),
  })
  .strict();

export const SubmitKycForReviewInputSchema = GetSubCustomerInputSchema;

export const ListInvoicesInputSchema = z
  .object({
    status: InvoiceStatusSchema.or(z.literal('all')).optional(),
    source: z.enum(['gmail', 'manual', 'agent', 'all']).optional(),
    query: z.string().optional(),
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

export const ScanInvoicesInputSchema = EmptyInputSchema;
export const IgnoreInvoiceInputSchema = GetInvoiceInputSchema;
export const SearchInvoicesInputSchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

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
    status: RecurringStatusSchema.optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    timeOfDay: z.string().optional(),
  })
  .strict();

export const PauseRecurringPaymentInputSchema = z
  .object({ recurringId: z.string().min(1) })
  .strict();
export const ResumeRecurringPaymentInputSchema = PauseRecurringPaymentInputSchema;

export const ListSuppliersInputSchema = EmptyInputSchema;
export const ListEmployeesInputSchema = EmptyInputSchema;

export const CreateEmployeeInputSchema = z
  .object({
    name: z.string().min(1),
    role: z.string().min(1).optional(),
    salary: z.number().positive(),
    currency: CurrencySchema,
    destinationKind: DestinationKindSchema.optional(),
    destinationLabel: z.string().optional(),
    destinationValue: z.string().optional(),
  })
  .strict();

export const PrepareSupplierPaymentInputSchema = z
  .object({
    supplierId: z.string().optional(),
    supplierName: z.string().optional(),
    amount: MoneyAmountSchema,
    reference: z.string().max(140).optional(),
  })
  .strict();

export const PreparePayrollInputSchema = z
  .object({
    period: z.string().optional(),
    employeeIds: z.array(z.string()).optional(),
    importId: z.string().uuid().optional(),
  })
  .strict();

export const InspectPayrollAttachmentInputSchema = z
  .object({ attachmentId: z.string().uuid() })
  .strict();

export const ListNotificationsInputSchema = z
  .object({
    unreadOnly: z.boolean().optional(),
  })
  .strict();

export const ListIntegrationsInputSchema = EmptyInputSchema;

export const CheckPolicyInputSchema = z
  .object({
    action: z.string().min(1),
    amount: MoneyAmountSchema.optional(),
    destinationValue: z.string().optional(),
  })
  .strict();

export const ListPoliciesInputSchema = EmptyInputSchema;

export const CreatePaymentRequestInputSchema = z
  .object({
    amount: MoneyAmountSchema.optional(),
    currency: CurrencySchema.optional(),
    memo: z.string().optional(),
  })
  .strict();

export const ListBeneficiariesInputSchema = EmptyInputSchema;
export const VerifyBeneficiaryInputSchema = z
  .object({
    beneficiaryId: z.string().min(1),
  })
  .strict();

export const RecommendPaymentMethodInputSchema = PreviewPaymentInputSchema;
export const RecommendCheapestRailInputSchema = PreviewPaymentInputSchema;
export const DetectDuplicatePaymentsInputSchema = z
  .object({
    amount: MoneyAmountSchema.optional(),
    destinationValue: z.string().optional(),
    withinHours: z.number().positive().optional(),
  })
  .strict();

export const SearchWalletsInputSchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

// ── New layers: plans, MCP tx, policy CRUD, capabilities, async, context ───

export const CreateFinancialPlanInputSchema = z
  .object({
    intent: z.string().min(1),
    items: z
      .array(
        z.object({
          kind: z.enum(['payment', 'payroll', 'invoice', 'supplier', 'conversion', 'recurring']),
          label: z.string().optional(),
          amount: MoneyAmountSchema.optional(),
          currency: CurrencySchema.optional(),
          refId: z.string().optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const GetFinancialPlanInputSchema = z
  .object({
    planId: z.string().min(1),
  })
  .strict();

export const BeginTransactionInputSchema = z
  .object({
    label: z.string().optional(),
  })
  .strict();

export const CommitTransactionInputSchema = z
  .object({
    transactionId: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

export const RollbackTransactionInputSchema = z
  .object({
    transactionId: z.string().min(1),
    reason: z.string().optional(),
  })
  .strict();

export const GetPaymentStatusInputSchema = z
  .object({
    paymentId: z.string().optional(),
    preparationId: z.string().optional(),
    transactionId: z.string().optional(),
  })
  .strict();

export const EvaluatePolicyInputSchema = CheckPolicyInputSchema;

export const CreatePolicyInputSchema = z
  .object({
    name: z.string().min(1),
    rule: z.string().min(1),
    enabled: z.boolean().optional(),
  })
  .strict();

export const UpdatePolicyInputSchema = z
  .object({
    policyId: z.string().min(1),
    name: z.string().optional(),
    rule: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export const DeletePolicyInputSchema = z
  .object({
    policyId: z.string().min(1),
  })
  .strict();

export const AssignPolicyInputSchema = z
  .object({
    policyId: z.string().min(1),
    targetType: z.enum(['account', 'wallet', 'user']),
    targetId: z.string().min(1),
  })
  .strict();

export const SimulatePolicyInputSchema = CheckPolicyInputSchema;

export const ListSupportedPaymentRailsInputSchema = EmptyInputSchema;
export const ListSupportedCountriesInputSchema = EmptyInputSchema;
export const ListSupportedAssetsInputSchema = EmptyInputSchema;
export const ListSupportedBlockchainsInputSchema = EmptyInputSchema;
export const ListSupportedNetworksInputSchema = EmptyInputSchema;

export const GetInvoiceSourceEmailInputSchema = z
  .object({
    invoiceId: z.string().min(1),
  })
  .strict();

export const GetRecentContextInputSchema = z
  .object({
    limit: z.number().int().positive().max(50).optional(),
  })
  .strict();

export const GetRecentRecipientsInputSchema = GetRecentContextInputSchema;
export const GetRecentTransactionsContextInputSchema = GetRecentContextInputSchema;
export const ResolveLastRecipientInputSchema = EmptyInputSchema;
export const ResolveLastWalletInputSchema = EmptyInputSchema;

export const FindBestWalletInputSchema = z
  .object({
    amount: MoneyAmountSchema.optional(),
    currency: CurrencySchema.optional(),
    destinationCountry: z.string().optional(),
  })
  .strict();

export const FindBestCurrencyInputSchema = FindBestWalletInputSchema;
export const RecommendFundingSourceInputSchema = FindBestWalletInputSchema;
export const RecommendPaymentRouteInputSchema = PreviewPaymentInputSchema;
export const RecommendPaymentScheduleInputSchema = z
  .object({
    dueDate: z.string().optional(),
    amount: MoneyAmountSchema.optional(),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const WaitForPaymentInputSchema = GetPaymentStatusInputSchema.extend({
  timeoutMs: z.number().int().positive().max(120_000).optional(),
}).strict();

export const SubscribePaymentUpdatesInputSchema = GetPaymentStatusInputSchema;
export const ListPendingTransfersInputSchema = EmptyInputSchema;

export const ListEventTypesInputSchema = EmptyInputSchema;
export const SubscribeEventsInputSchema = z
  .object({
    eventTypes: z.array(z.string()).min(1),
  })
  .strict();
export const UnsubscribeEventsInputSchema = z
  .object({
    subscriptionId: z.string().min(1),
  })
  .strict();
export const ListWebhooksInputSchema = EmptyInputSchema;
export const CreateWebhookInputSchema = z
  .object({
    url: z.string().url(),
    eventTypes: z.array(z.string()).min(1),
  })
  .strict();
export const DeleteWebhookInputSchema = z
  .object({
    webhookId: z.string().min(1),
  })
  .strict();

/**
 * Schemas for curated high-level MCP tools only.
 * Platform keeps a richer operation set; those schemas live as named exports above.
 */
export const TOOL_INPUT_SCHEMAS = {
  ping: PingInputSchema,
  get_current_user: EmptyInputSchema,
  get_balances: GetBalancesInputSchema,
  get_gmail_status: GetGmailStatusInputSchema,
  search_gmail_messages: SearchGmailMessagesInputSchema,
  get_gmail_message: GetGmailMessageInputSchema,
  find_gmail_invoices: FindGmailInvoicesInputSchema,
  list_wallets: ListWalletsInputSchema,
  search_recipient: SearchRecipientInputSchema,
  prepare_payment: PreparePaymentInputSchema,
  request_approval: RequestApprovalInputSchema,
  get_payment_status: GetPaymentStatusInputSchema,
  prepare_conversion: PrepareConversionInputSchema,
  prepare_invoice_payment: PrepareInvoicePaymentInputSchema,
  prepare_supplier_payment: PrepareSupplierPaymentInputSchema,
  prepare_payroll: PreparePayrollInputSchema,
  list_transactions: ListTransactionsInputSchema,
  list_invoices: ListInvoicesInputSchema,
  list_notifications: ListNotificationsInputSchema,
  create_financial_plan: CreateFinancialPlanInputSchema,
  begin_transaction: BeginTransactionInputSchema,
  commit_transaction: CommitTransactionInputSchema,
  rollback_transaction: RollbackTransactionInputSchema,
  evaluate_policy: EvaluatePolicyInputSchema,
  list_supported_payment_rails: ListSupportedPaymentRailsInputSchema,
  list_supported_countries: ListSupportedCountriesInputSchema,
  list_supported_assets: ListSupportedAssetsInputSchema,
  get_recent_context: GetRecentContextInputSchema,
} as const satisfies Record<McpRegistryToolName, z.ZodTypeAny>;

export type McpToolName = McpRegistryToolName;
