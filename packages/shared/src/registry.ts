/**
 * Finora AI Tool Registry — three surfaces, one contract.
 *
 * - mobile: in-app Gemini / local runtime (PIN, biometrics, theme, threads)
 * - platform: Finora API (rich operation set; includes execute_* after human approval)
 * - mcp: curated high-level tools for external agents — read + prepare only; NEVER execute money
 *
 * Code ids are snake_case. camelCase is the product-facing alias.
 *
 * Money path: prepare_* → (optional create_financial_plan / begin_transaction) →
 * request_approval → human PIN → execute_approved_* → audit → WeWire
 */

export type ToolSurface = 'mobile' | 'platform' | 'mcp';
export type ToolRisk = 'read' | 'prepare' | 'execute' | 'local';

export type ToolRegistryEntry = {
  name: string;
  camel: string;
  category: string;
  surfaces: readonly ToolSurface[];
  risk: ToolRisk;
  description: string;
};

function t<
  const N extends string,
  const Camel extends string,
  const Cat extends string,
  const S extends readonly ToolSurface[],
  const R extends ToolRisk,
>(
  name: N,
  camel: Camel,
  category: Cat,
  surfaces: S,
  risk: R,
  description: string,
) {
  return { name, camel, category, surfaces, risk, description } as const;
}

/**
 * Full catalog.
 * Only curated high-level tools include the `mcp` surface — platform stays rich;
 * MCP agents see a small orchestrating set that calls lower-level /v1 APIs internally.
 */
export const TOOL_REGISTRY = [
  // ── Health ───────────────────────────────────────────────────────────────
  t('ping', 'ping', 'health', ['platform', 'mcp'], 'read', 'Health check'),

  // ── Auth & user (platform / mobile; never MCP) ───────────────────────────
  t('create_user', 'createUser', 'auth', ['platform'], 'execute', 'Create Finora account and start onboarding'),
  t('login_user', 'loginUser', 'auth', ['platform', 'mobile'], 'execute', 'Authenticate a user'),
  t('logout_user', 'logoutUser', 'auth', ['platform', 'mobile'], 'execute', 'End current session'),
  t('refresh_session', 'refreshSession', 'auth', ['platform', 'mobile'], 'execute', 'Refresh auth token'),
  t('get_current_user', 'getCurrentUser', 'auth', ['platform', 'mobile'], 'read', 'Return authenticated user'),
  t('update_profile', 'updateProfile', 'auth', ['platform', 'mobile'], 'execute', 'Update profile'),
  t('delete_account', 'deleteAccount', 'auth', ['platform', 'mobile'], 'execute', 'Delete Finora account'),
  t('enable_biometrics', 'enableBiometrics', 'auth', ['mobile'], 'local', 'Enable Face ID / fingerprint'),
  t('disable_biometrics', 'disableBiometrics', 'auth', ['mobile'], 'local', 'Disable biometrics'),
  t('create_pin', 'createPIN', 'auth', ['mobile', 'platform'], 'execute', 'Create transaction PIN / passcode'),
  t('verify_pin', 'verifyPIN', 'auth', ['mobile', 'platform'], 'execute', 'Verify transaction PIN (human gate)'),
  t('change_transaction_pin', 'changeTransactionPIN', 'security', ['mobile', 'platform'], 'execute', 'Change PIN'),

  // ── WeWire / account provisioning ────────────────────────────────────────
  t('create_financial_account', 'createFinancialAccount', 'provisioning', ['platform'], 'prepare', 'Create WeWire-backed sub-customer profile'),
  t('get_financial_account', 'getFinancialAccount', 'provisioning', ['platform'], 'read', 'Return financial account details'),
  t('list_subcustomers', 'listSubcustomers', 'provisioning', ['platform'], 'read', 'List sub-customers'),
  t('archive_subcustomer', 'archiveSubcustomer', 'provisioning', ['platform'], 'execute', 'Archive a sub-customer'),
  t('update_business_information', 'updateBusinessInformation', 'provisioning', ['platform'], 'execute', 'Update business profile'),
  t('start_kyc', 'startKYC', 'kyc', ['platform'], 'prepare', 'Start KYC verification'),
  t('submit_kyc', 'submitKYC', 'kyc', ['platform'], 'prepare', 'Submit identity information'),
  t('get_kyc_status', 'getKYCStatus', 'kyc', ['platform'], 'read', 'Check KYC progress'),
  t('get_kyc_link', 'getKYCLink', 'kyc', ['platform'], 'read', 'Hosted KYC link'),
  t('list_kyc_requirements', 'listKYCRequirements', 'kyc', ['platform'], 'read', 'KYC document requirements'),
  t('add_beneficial_owner', 'addBeneficialOwner', 'kyc', ['platform'], 'prepare', 'Add beneficial owner'),
  t('submit_kyc_for_review', 'submitKYCForReview', 'kyc', ['platform'], 'prepare', 'Submit KYC package for review'),

  // ── Wallets ──────────────────────────────────────────────────────────────
  t('list_wallets', 'listWallets', 'wallets', ['platform', 'mcp'], 'read', 'List wallets'),
  t('get_wallet', 'getWallet', 'wallets', ['platform'], 'read', 'Get one wallet'),
  t('get_balances', 'getBalance', 'wallets', ['platform', 'mcp'], 'read', 'Get balances'),
  t('create_wallet', 'createWallet', 'wallets', ['platform'], 'execute', 'Create wallet'),
  t('freeze_wallet', 'freezeWallet', 'wallets', ['platform'], 'execute', 'Freeze wallet'),
  t('unfreeze_wallet', 'unfreezeWallet', 'wallets', ['platform'], 'execute', 'Unfreeze wallet'),
  t('list_supported_currencies', 'listSupportedCurrencies', 'wallets', ['platform'], 'read', 'Supported wallet currencies'),
  t('get_wallet_limits', 'getWalletLimits', 'wallets', ['platform'], 'read', 'Wallet limits'),
  t('prepare_wallet_transfer', 'transferBetweenWallets', 'wallets', ['platform'], 'prepare', 'Prepare internal wallet transfer'),
  t('execute_approved_wallet_transfer', 'executeWalletTransfer', 'wallets', ['platform', 'mobile'], 'execute', 'Execute wallet transfer after approval'),

  // ── Virtual accounts ─────────────────────────────────────────────────────
  t('create_virtual_account', 'createVirtualAccount', 'virtual_accounts', ['platform'], 'execute', 'Create virtual bank account'),
  t('list_virtual_accounts', 'listVirtualAccounts', 'virtual_accounts', ['platform'], 'read', 'List virtual accounts'),
  t('get_virtual_account', 'getVirtualAccount', 'virtual_accounts', ['platform'], 'read', 'Get virtual account'),
  t('share_virtual_account', 'shareVirtualAccount', 'virtual_accounts', ['platform', 'mobile'], 'read', 'Shareable VA payment details'),

  // ── Stablecoins / crypto ─────────────────────────────────────────────────
  t('create_crypto_wallet', 'createCryptoWallet', 'crypto', ['platform'], 'execute', 'Create USDT/USDC wallet'),
  t('get_crypto_wallet', 'getCryptoWallet', 'crypto', ['platform'], 'read', 'Get crypto wallet'),
  t('list_crypto_addresses', 'getWalletAddress', 'crypto', ['platform'], 'read', 'List/get receive addresses'),
  t('generate_receive_qr', 'generateReceiveQRCode', 'receive', ['platform', 'mobile'], 'read', 'Generate receive QR'),
  t('validate_wallet_address', 'validateWalletAddress', 'crypto', ['platform'], 'read', 'Validate crypto address'),
  t('prepare_usdt_transfer', 'sendUSDT', 'crypto', ['platform'], 'prepare', 'Prepare USDT transfer'),
  t('prepare_usdc_transfer', 'sendUSDC', 'crypto', ['platform'], 'prepare', 'Prepare USDC transfer'),
  t('execute_approved_crypto_transfer', 'executeCryptoTransfer', 'crypto', ['platform', 'mobile'], 'execute', 'Execute crypto transfer after approval'),
  t('estimate_network_fee', 'estimateNetworkFee', 'crypto', ['platform'], 'read', 'Estimate blockchain fee'),
  t('select_blockchain_network', 'selectBlockchainNetwork', 'crypto', ['platform', 'mobile'], 'local', 'Choose blockchain network'),

  // ── Contacts ─────────────────────────────────────────────────────────────
  t('create_contact', 'createContact', 'contacts', ['platform'], 'execute', 'Create contact'),
  t('update_contact', 'updateContact', 'contacts', ['platform'], 'execute', 'Update contact'),
  t('delete_contact', 'deleteContact', 'contacts', ['platform'], 'execute', 'Delete contact'),
  t('list_contacts', 'listContacts', 'contacts', ['platform'], 'read', 'List contacts'),
  t('search_contacts', 'searchContacts', 'contacts', ['platform'], 'read', 'Search contacts'),
  t('favorite_contact', 'favoriteContact', 'contacts', ['platform', 'mobile'], 'execute', 'Favorite contact'),
  t('merge_contacts', 'mergeContacts', 'contacts', ['platform'], 'execute', 'Merge duplicate contacts'),
  t('save_contact', 'saveRecipient', 'contacts', ['platform'], 'execute', 'Save recipient after payment'),

  // ── Beneficiaries ────────────────────────────────────────────────────────
  t('create_beneficiary', 'createBeneficiary', 'beneficiaries', ['platform'], 'execute', 'Create payment beneficiary'),
  t('update_beneficiary', 'updateBeneficiary', 'beneficiaries', ['platform'], 'execute', 'Update beneficiary'),
  t('delete_beneficiary', 'deleteBeneficiary', 'beneficiaries', ['platform'], 'execute', 'Delete beneficiary'),
  t('list_beneficiaries', 'listBeneficiaries', 'beneficiaries', ['platform'], 'read', 'List beneficiaries'),
  t('verify_beneficiary', 'verifyBeneficiary', 'beneficiaries', ['platform'], 'read', 'Verify beneficiary details'),

  // ── Recipient lookup ─────────────────────────────────────────────────────
  t('lookup_bank_account', 'lookupBankAccount', 'lookup', ['platform'], 'read', 'Lookup bank account name'),
  t('lookup_mobile_money', 'lookupMobileMoney', 'lookup', ['platform'], 'read', 'Lookup MoMo account'),
  t('lookup_crypto_recipient', 'lookupCryptoRecipient', 'lookup', ['platform'], 'read', 'Lookup crypto recipient'),
  t('resolve_recipient', 'resolveRecipient', 'lookup', ['platform'], 'read', 'Resolve names like Ama'),
  t('resolve_duplicate_recipients', 'resolveDuplicateRecipients', 'lookup', ['platform'], 'read', 'Disambiguate multiple matches'),
  t('lookup_account', 'lookupAccount', 'lookup', ['platform'], 'read', 'Generic destination lookup'),
  t('search_recipient', 'searchRecipient', 'lookup', ['platform', 'mcp'], 'read', 'Search / resolve recipients (MCP high-level)'),

  // ── Payments ─────────────────────────────────────────────────────────────
  t('preview_payment', 'previewPayment', 'payments', ['platform'], 'read', 'Payment summary before send'),
  t('prepare_payment', 'preparePayment', 'payments', ['platform', 'mcp'], 'prepare', 'Prepare payout for human approval'),
  t('prepare_momo_disbursement', 'sendMobileMoney', 'payments', ['platform'], 'prepare', 'Prepare MoMo disbursement'),
  t('prepare_bank_transfer', 'sendBankTransfer', 'payments', ['platform'], 'prepare', 'Prepare bank transfer'),
  t('prepare_internal_transfer', 'prepareInternalTransfer', 'payments', ['platform'], 'prepare', 'Prepare sub-customer transfer'),
  t('execute_approved_payment', 'sendMoney', 'payments', ['platform', 'mobile'], 'execute', 'Execute after human approval + PIN'),
  t('cancel_payment', 'cancelPayment', 'payments', ['platform', 'mobile'], 'execute', 'Cancel pending payment'),
  t('cancel_preparation', 'cancelPreparation', 'payments', ['platform'], 'prepare', 'Agent retracts a preparation'),
  t('repeat_payment', 'repeatPayment', 'payments', ['platform', 'mobile'], 'prepare', 'Repeat previous payment (re-prepare)'),
  t('estimate_fees', 'estimateFees', 'payments', ['platform'], 'read', 'Estimate fees'),
  t('estimate_delivery_time', 'estimateDeliveryTime', 'payments', ['platform'], 'read', 'Predict arrival time'),
  t('verify_bank_account', 'verifyBankAccount', 'payments', ['platform'], 'read', 'Verify bank details'),
  t('list_supported_banks', 'listSupportedBanks', 'payments', ['platform'], 'read', 'Supported banks'),
  t('verify_mobile_money', 'verifyMobileMoney', 'payments', ['platform'], 'read', 'Verify MoMo recipient'),
  t('list_momo_networks', 'listNetworks', 'payments', ['platform'], 'read', 'List MoMo networks'),

  // ── Async payment status ─────────────────────────────────────────────────
  t('get_payment_status', 'getPaymentStatus', 'payments', ['platform', 'mcp'], 'read', 'Poll payment / transfer status'),
  t('wait_for_payment', 'waitForPayment', 'payments', ['platform'], 'read', 'Block until payment reaches a terminal status (server-side poll)'),
  t('subscribe_payment_updates', 'subscribePaymentUpdates', 'payments', ['platform'], 'prepare', 'Subscribe to payment status events'),
  t('list_pending_transfers', 'listPendingTransfers', 'payments', ['platform'], 'read', 'List in-flight transfers'),

  // ── FX ───────────────────────────────────────────────────────────────────
  t('list_fx_rates', 'listFxRates', 'fx', ['platform'], 'read', 'List FX rates'),
  t('get_fx_rate', 'getExchangeRate', 'fx', ['platform'], 'read', 'Get pair rate'),
  t('preview_conversion', 'previewConversion', 'fx', ['platform'], 'read', 'Preview conversion quote'),
  t('prepare_conversion', 'convertCurrency', 'fx', ['platform', 'mcp'], 'prepare', 'Prepare FX conversion for approval'),
  t('execute_approved_conversion', 'executeConversion', 'fx', ['platform', 'mobile'], 'execute', 'Execute conversion after approval'),

  // ── Receive ──────────────────────────────────────────────────────────────
  t('list_receive_methods', 'listReceiveMethods', 'receive', ['platform'], 'read', 'VA / MoMo / crypto receive options'),
  t('generate_payment_link', 'generatePaymentLink', 'receive', ['platform', 'mobile'], 'execute', 'Create payment link'),
  t('create_payment_request', 'createPaymentRequest', 'receive', ['platform'], 'prepare', 'Create payment request'),
  t('share_receive_details', 'shareReceiveDetails', 'receive', ['mobile'], 'local', 'Share receiving information'),

  // ── Transactions ─────────────────────────────────────────────────────────
  t('list_transactions', 'listTransactions', 'transactions', ['platform', 'mcp'], 'read', 'List transactions'),
  t('get_transaction', 'getTransaction', 'transactions', ['platform'], 'read', 'Transaction detail'),
  t('search_transactions', 'searchTransactions', 'transactions', ['platform'], 'read', 'Search history'),
  t('filter_transactions', 'filterTransactions', 'transactions', ['platform'], 'read', 'Filter history'),
  t('download_receipt', 'downloadReceipt', 'transactions', ['platform', 'mobile'], 'read', 'Download receipt'),
  t('share_receipt', 'shareReceipt', 'transactions', ['mobile'], 'local', 'Share receipt'),
  t('export_statement', 'exportStatement', 'transactions', ['platform', 'mobile'], 'read', 'Export statement'),

  // ── Gmail / invoices ─────────────────────────────────────────────────────
  t('connect_gmail', 'connectGmail', 'gmail', ['platform', 'mobile'], 'execute', 'Connect Gmail'),
  t('disconnect_gmail', 'disconnectGmail', 'gmail', ['platform', 'mobile'], 'execute', 'Disconnect Gmail'),
  t('sync_emails', 'syncEmails', 'gmail', ['platform'], 'execute', 'Sync mailbox'),
  t('scan_invoices', 'scanInvoices', 'gmail', ['platform'], 'read', 'Find invoices in mail'),
  t('get_invoice_source_email', 'getInvoiceSourceEmail', 'gmail', ['platform'], 'read', 'Source email for an invoice (from/subject)'),
  t('list_invoices', 'listInvoices', 'invoices', ['platform', 'mcp'], 'read', 'List invoices'),
  t('get_invoice', 'getInvoice', 'invoices', ['platform'], 'read', 'Get invoice'),
  t('mark_invoice_paid', 'markInvoicePaid', 'invoices', ['platform'], 'execute', 'Mark invoice paid'),
  t('ignore_invoice', 'ignoreInvoice', 'invoices', ['platform'], 'execute', 'Ignore invoice'),
  t('prepare_invoice_payment', 'payInvoice', 'invoices', ['platform', 'mcp'], 'prepare', 'Prepare invoice payment'),
  t('execute_approved_invoice_payment', 'executeInvoicePayment', 'invoices', ['platform', 'mobile'], 'execute', 'Execute invoice payment after approval'),
  t('archive_invoice', 'archiveInvoice', 'invoices', ['platform'], 'execute', 'Archive invoice'),
  t('set_invoice_reminder', 'setInvoiceReminder', 'invoices', ['platform', 'mobile'], 'execute', 'Invoice reminder'),

  // ── Recurring ────────────────────────────────────────────────────────────
  t('prepare_recurring_payment', 'createRecurringPayment', 'recurring', ['platform'], 'prepare', 'Prepare recurring schedule'),
  t('execute_approved_recurring_payment', 'executeRecurringPayment', 'recurring', ['platform', 'mobile'], 'execute', 'Activate recurring after approval'),
  t('list_recurring_payments', 'listRecurringPayments', 'recurring', ['platform'], 'read', 'List recurring payments'),
  t('update_recurring_payment', 'updateRecurringPayment', 'recurring', ['platform'], 'execute', 'Update recurring'),
  t('pause_recurring_payment', 'pauseRecurringPayment', 'recurring', ['platform'], 'execute', 'Pause recurring'),
  t('resume_recurring_payment', 'resumeRecurringPayment', 'recurring', ['platform'], 'execute', 'Resume recurring'),
  t('delete_recurring_payment', 'deleteRecurringPayment', 'recurring', ['platform'], 'execute', 'Delete recurring'),

  // ── Business ─────────────────────────────────────────────────────────────
  t('create_supplier', 'createSupplier', 'business', ['platform'], 'execute', 'Create supplier'),
  t('update_supplier', 'updateSupplier', 'business', ['platform'], 'execute', 'Update supplier'),
  t('delete_supplier', 'deleteSupplier', 'business', ['platform'], 'execute', 'Delete supplier'),
  t('list_suppliers', 'listSuppliers', 'business', ['platform'], 'read', 'List suppliers'),
  t('prepare_supplier_payment', 'paySupplier', 'business', ['platform', 'mcp'], 'prepare', 'Prepare supplier payment'),
  t('execute_approved_supplier_payment', 'executeSupplierPayment', 'business', ['platform', 'mobile'], 'execute', 'Execute supplier payment after approval'),
  t('create_employee', 'createEmployee', 'business', ['platform'], 'execute', 'Create employee'),
  t('list_employees', 'listEmployees', 'business', ['platform'], 'read', 'List employees'),
  t('prepare_payroll', 'runPayroll', 'business', ['platform', 'mcp'], 'prepare', 'Prepare payroll run'),
  t('execute_approved_payroll', 'executePayroll', 'business', ['platform', 'mobile'], 'execute', 'Execute payroll after approval + PIN'),

  // ── Financial plans (multi-step batch before approval) ───────────────────
  t('create_financial_plan', 'createFinancialPlan', 'plans', ['platform', 'mcp'], 'prepare', 'Build a multi-item money plan for one approval'),
  t('get_financial_plan', 'getFinancialPlan', 'plans', ['platform'], 'read', 'Get a financial plan by id'),
  t('list_financial_plans', 'listFinancialPlans', 'plans', ['platform'], 'read', 'List financial plans'),
  t('cancel_financial_plan', 'cancelFinancialPlan', 'plans', ['platform'], 'prepare', 'Cancel a draft / pending plan'),
  t('execute_approved_financial_plan', 'executeFinancialPlan', 'plans', ['platform', 'mobile'], 'execute', 'Execute all plan items after approval'),

  // ── MCP agent transactions (unit of work over preparations) ──────────────
  t('begin_transaction', 'beginTransaction', 'mcp_tx', ['platform', 'mcp'], 'prepare', 'Open an agent transaction spanning related prepares'),
  t('commit_transaction', 'commitTransaction', 'mcp_tx', ['platform', 'mcp'], 'prepare', 'Commit agent transaction → request human approval for all items'),
  t('rollback_transaction', 'rollbackTransaction', 'mcp_tx', ['platform', 'mcp'], 'prepare', 'Roll back agent transaction and cancel preparations'),

  // ── Notifications ────────────────────────────────────────────────────────
  t('list_notifications', 'listNotifications', 'notifications', ['platform', 'mcp', 'mobile'], 'read', 'List notifications'),
  t('mark_notification_read', 'markNotificationRead', 'notifications', ['platform', 'mobile'], 'execute', 'Mark notification read'),
  t('delete_notification', 'deleteNotification', 'notifications', ['platform', 'mobile'], 'execute', 'Delete notification'),
  t('update_notification_preferences', 'updateNotificationPreferences', 'notifications', ['mobile', 'platform'], 'execute', 'Notification prefs'),

  // ── Approval engine ──────────────────────────────────────────────────────
  t('create_approval_request', 'createApprovalRequest', 'approvals', ['platform'], 'prepare', 'Create approval flow'),
  t('list_approvals', 'getPendingApprovals', 'approvals', ['platform'], 'read', 'List approvals / pending'),
  t('get_approval', 'getApproval', 'approvals', ['platform'], 'read', 'Get approval detail'),
  t('request_approval', 'requestApproval', 'approvals', ['platform', 'mcp'], 'prepare', 'Notify human of pending approval / plan'),
  t('approve_transaction', 'approveTransaction', 'approvals', ['platform', 'mobile'], 'execute', 'Human approves (decision only; does not settle rails)'),
  t('reject_transaction', 'rejectTransaction', 'approvals', ['platform', 'mobile'], 'execute', 'Human rejects transaction'),
  t('verify_biometric_approval', 'verifyBiometricApproval', 'approvals', ['mobile'], 'local', 'Biometric gate'),
  t('verify_transaction_pin', 'verifyTransactionPIN', 'approvals', ['mobile', 'platform'], 'execute', 'PIN gate for approval'),

  // ── Policy (differentiator) ──────────────────────────────────────────────
  t('list_policies', 'listPolicies', 'policy', ['platform'], 'read', 'List account policies'),
  t('create_policy', 'createPolicy', 'policy', ['platform'], 'execute', 'Create spending / approval policy'),
  t('update_policy', 'updatePolicy', 'policy', ['platform'], 'execute', 'Update a policy'),
  t('delete_policy', 'deletePolicy', 'policy', ['platform'], 'execute', 'Delete a policy'),
  t('assign_policy', 'assignPolicy', 'policy', ['platform'], 'execute', 'Assign policy to account / wallet / user'),
  t('simulate_policy', 'simulatePolicy', 'policy', ['platform'], 'read', 'Dry-run policy against a hypothetical action'),
  t('evaluate_policy', 'evaluatePolicy', 'policy', ['platform', 'mcp'], 'read', 'Evaluate policy for an action (alias check_policy)'),
  t('check_policy', 'checkPolicy', 'policy', ['platform'], 'read', 'Evaluate policy before prepare'),
  t('get_audit_logs', 'getAuditLogs', 'security', ['platform'], 'read', 'Financial + security audit logs'),

  // ── Capability discovery ─────────────────────────────────────────────────
  t('list_supported_payment_rails', 'listSupportedPaymentRails', 'capabilities', ['platform', 'mcp'], 'read', 'Supported payment rails'),
  t('list_supported_countries', 'listSupportedCountries', 'capabilities', ['platform', 'mcp'], 'read', 'Supported countries'),
  t('list_supported_assets', 'listSupportedAssets', 'capabilities', ['platform', 'mcp'], 'read', 'Supported fiat + crypto assets'),
  t('list_supported_blockchains', 'listSupportedBlockchains', 'capabilities', ['platform'], 'read', 'Supported blockchains'),
  t('list_supported_networks', 'listSupportedNetworks', 'capabilities', ['platform'], 'read', 'Supported MoMo / card / crypto networks'),

  // ── Events / webhooks ────────────────────────────────────────────────────
  t('list_event_types', 'listEventTypes', 'events', ['platform'], 'read', 'List webhook event types'),
  t('subscribe_events', 'subscribeEvents', 'events', ['platform'], 'prepare', 'Subscribe to event stream'),
  t('unsubscribe_events', 'unsubscribeEvents', 'events', ['platform'], 'execute', 'Unsubscribe from events'),
  t('list_webhooks', 'listWebhooks', 'events', ['platform'], 'read', 'List webhook endpoints'),
  t('create_webhook', 'createWebhook', 'events', ['platform'], 'execute', 'Create webhook endpoint'),
  t('delete_webhook', 'deleteWebhook', 'events', ['platform'], 'execute', 'Delete webhook endpoint'),

  // ── Conversation context (pronoun / “again” resolution) ──────────────────
  t('get_recent_recipients', 'getRecentRecipients', 'context', ['platform', 'mobile'], 'read', 'Recent payment recipients'),
  t('get_recent_transactions', 'getRecentTransactions', 'context', ['platform', 'mobile'], 'read', 'Recent transactions for context'),
  t('get_recent_context', 'getRecentContext', 'context', ['platform', 'mcp', 'mobile'], 'read', 'Bundle of recent recipients / wallets / txs'),
  t('resolve_last_recipient', 'resolveLastRecipient', 'context', ['platform', 'mobile'], 'read', 'Resolve “her/him/them” to last recipient'),
  t('resolve_last_wallet', 'resolveLastWallet', 'context', ['platform', 'mobile'], 'read', 'Resolve last-used wallet'),

  // ── AI memory ───────────────────────────────────────────────────────────
  t('remember_preference', 'rememberPreference', 'memory', ['platform', 'mobile'], 'execute', 'Store preference'),
  t('remember_contact', 'rememberContact', 'memory', ['platform', 'mobile'], 'execute', 'Learn recipient'),
  t('remember_supplier', 'rememberSupplier', 'memory', ['platform', 'mobile'], 'execute', 'Learn supplier'),
  t('forget_memory', 'forgetMemory', 'memory', ['platform', 'mobile'], 'execute', 'Delete memory'),
  t('list_memories', 'listMemories', 'memory', ['platform', 'mobile'], 'read', 'List memories'),

  // ── Conversations (mobile) ───────────────────────────────────────────────
  t('create_conversation', 'createConversation', 'conversations', ['mobile'], 'local', 'New chat thread'),
  t('list_conversations', 'listConversations', 'conversations', ['mobile'], 'local', 'List chats'),
  t('rename_conversation', 'renameConversation', 'conversations', ['mobile'], 'local', 'Rename chat'),
  t('delete_conversation', 'deleteConversation', 'conversations', ['mobile'], 'local', 'Delete chat'),
  t('archive_conversation', 'archiveConversation', 'conversations', ['mobile'], 'local', 'Archive chat'),
  t('search_conversation', 'searchConversation', 'conversations', ['mobile'], 'local', 'Search chats'),

  // ── Global search ────────────────────────────────────────────────────────
  t('search_everything', 'searchEverything', 'search', ['platform', 'mobile'], 'read', 'Global search'),
  t('search_wallets', 'searchWallets', 'search', ['platform'], 'read', 'Search wallets'),
  t('search_invoices', 'searchInvoices', 'search', ['platform'], 'read', 'Search invoices'),
  t('search_businesses', 'searchBusinesses', 'search', ['platform'], 'read', 'Search businesses'),

  // ── Integrations ─────────────────────────────────────────────────────────
  t('connect_google_drive', 'connectGoogleDrive', 'integrations', ['platform', 'mobile'], 'execute', 'Connect Drive'),
  t('connect_google_calendar', 'connectGoogleCalendar', 'integrations', ['platform', 'mobile'], 'execute', 'Connect Calendar'),
  t('connect_whatsapp', 'connectWhatsApp', 'integrations', ['platform', 'mobile'], 'execute', 'Connect WhatsApp'),
  t('connect_slack', 'connectSlack', 'integrations', ['platform', 'mobile'], 'execute', 'Connect Slack'),
  t('connect_quickbooks', 'connectQuickBooks', 'integrations', ['platform', 'mobile'], 'execute', 'Connect QuickBooks'),
  t('disconnect_integration', 'disconnectIntegration', 'integrations', ['platform', 'mobile'], 'execute', 'Disconnect integration'),
  t('list_integrations', 'listIntegrations', 'integrations', ['platform', 'mobile'], 'read', 'List integrations'),

  // ── Settings / security (mostly mobile) ──────────────────────────────────
  t('update_settings', 'updateSettings', 'settings', ['mobile', 'platform'], 'execute', 'Update settings'),
  t('change_theme', 'changeTheme', 'settings', ['mobile'], 'local', 'Change appearance'),
  t('change_language', 'changeLanguage', 'settings', ['mobile'], 'local', 'Change language'),
  t('update_security_settings', 'updateSecuritySettings', 'settings', ['mobile', 'platform'], 'execute', 'Security prefs'),
  t('list_trusted_devices', 'listTrustedDevices', 'security', ['platform', 'mobile'], 'read', 'Trusted devices'),
  t('revoke_device', 'revokeDevice', 'security', ['platform', 'mobile'], 'execute', 'Revoke device'),

  // ── AI intelligence / reasoning helpers ──────────────────────────────────
  t('summarize_spending', 'summarizeSpending', 'intelligence', ['platform', 'mobile'], 'read', 'Summarize spending'),
  t('analyze_cash_flow', 'analyzeCashFlow', 'intelligence', ['platform', 'mobile'], 'read', 'Analyze cash flow'),
  t('predict_upcoming_bills', 'predictUpcomingBills', 'intelligence', ['platform', 'mobile'], 'read', 'Predict bills'),
  t('recommend_payment_method', 'recommendPaymentMethod', 'intelligence', ['platform'], 'read', 'Recommend rail'),
  t('recommend_cheapest_rail', 'recommendCheapestRail', 'intelligence', ['platform'], 'read', 'Lowest-cost rail'),
  t('recommend_payment_route', 'recommendPaymentRoute', 'intelligence', ['platform'], 'read', 'Recommend end-to-end payment route'),
  t('recommend_payment_schedule', 'recommendPaymentSchedule', 'intelligence', ['platform'], 'read', 'Recommend when to pay'),
  t('recommend_funding_source', 'recommendFundingSource', 'intelligence', ['platform'], 'read', 'Recommend funding wallet / rail'),
  t('find_best_wallet', 'findBestWallet', 'intelligence', ['platform'], 'read', 'Pick best source wallet'),
  t('find_best_currency', 'findBestCurrency', 'intelligence', ['platform'], 'read', 'Pick best currency for a payment'),
  t('detect_duplicate_payments', 'detectDuplicatePayments', 'intelligence', ['platform'], 'read', 'Detect duplicates'),
  t('detect_fraud', 'detectFraud', 'intelligence', ['platform'], 'read', 'Flag suspicious activity'),
  t('categorize_transactions', 'categorizeTransactions', 'intelligence', ['platform'], 'execute', 'Auto-categorize'),
  t('generate_financial_insights', 'generateFinancialInsights', 'intelligence', ['platform', 'mobile'], 'read', 'Financial insights'),

  // ── Automation ───────────────────────────────────────────────────────────
  t('create_automation', 'createAutomation', 'automation', ['platform', 'mobile'], 'execute', 'Create automation rule'),
  t('update_automation', 'updateAutomation', 'automation', ['platform', 'mobile'], 'execute', 'Update rule'),
  t('pause_automation', 'pauseAutomation', 'automation', ['platform', 'mobile'], 'execute', 'Pause rule'),
  t('resume_automation', 'resumeAutomation', 'automation', ['platform', 'mobile'], 'execute', 'Resume rule'),
  t('delete_automation', 'deleteAutomation', 'automation', ['platform', 'mobile'], 'execute', 'Delete rule'),
  t('list_automations', 'listAutomations', 'automation', ['platform', 'mobile'], 'read', 'List automations'),
  t('execute_automation', 'executeAutomation', 'automation', ['platform', 'mobile'], 'execute', 'Run automation (may prepare payments only)'),

  // ── Legacy aliases (platform wiring) ─────────────────────────────────────
  t('create_subcustomer', 'createSubcustomer', 'provisioning', ['platform'], 'prepare', 'Alias of create_financial_account'),
  t('get_subcustomer', 'getSubcustomer', 'provisioning', ['platform'], 'read', 'Alias of get_financial_account'),
  t('submit_subcustomer_kyc', 'submitSubcustomerKyc', 'kyc', ['platform'], 'prepare', 'Alias of submit_kyc'),
  t('get_subcustomer_kyc_link', 'getSubcustomerKycLink', 'kyc', ['platform'], 'read', 'Alias of get_kyc_link'),
  t('get_kyc_requirements', 'getKycRequirements', 'kyc', ['platform'], 'read', 'Alias of list_kyc_requirements'),
] as const;

export type RegistryToolName = (typeof TOOL_REGISTRY)[number]['name'];

/** MCP-exposed tool ids: surface includes mcp AND risk is read|prepare (curated high-level set). */
export type McpRegistryToolName = {
  [E in (typeof TOOL_REGISTRY)[number] as 'mcp' extends E['surfaces'][number]
    ? E['risk'] extends 'read' | 'prepare'
      ? E['name']
      : never
    : never]: true;
} extends infer M
  ? keyof M & string
  : never;

function namesFor(surface: ToolSurface): RegistryToolName[] {
  return TOOL_REGISTRY.filter((e) => (e.surfaces as readonly ToolSurface[]).includes(surface)).map(
    (e) => e.name,
  );
}

/** Tools callable via Finora API (includes execute for mobile after PIN). */
export const PLATFORM_TOOL_NAMES = namesFor('platform');

/**
 * Curated high-level MCP tools only.
 * Rich lower-level operations live on platform; MCP orchestrates via these.
 */
export const MCP_TOOL_NAMES = TOOL_REGISTRY.filter(
  (e) =>
    (e.surfaces as readonly ToolSurface[]).includes('mcp') &&
    (e.risk === 'read' || e.risk === 'prepare'),
).map((e) => e.name) as McpRegistryToolName[];

/** In-app / local runtime tools. */
export const MOBILE_TOOL_NAMES = namesFor('mobile');

/** @deprecated Prefer PLATFORM_TOOL_NAMES — kept for API `/` listing. */
export const TOOL_NAMES = PLATFORM_TOOL_NAMES;

export function getToolEntry(name: string): (typeof TOOL_REGISTRY)[number] | undefined {
  return TOOL_REGISTRY.find((e) => e.name === name || e.camel === name);
}

/** camelCase product name → snake_case code id */
export const TOOL_CAMEL_ALIASES: Record<string, string> = Object.fromEntries(
  TOOL_REGISTRY.map((e) => [e.camel, e.name]),
);

export function isMcpSafeTool(name: string): boolean {
  return (MCP_TOOL_NAMES as readonly string[]).includes(name);
}
