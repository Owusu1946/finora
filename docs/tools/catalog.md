# Full tool catalog (by category)

Every entry lives in [`packages/shared/src/registry.ts`](../../packages/shared/src/registry.ts).

**Columns**

- **Risk:** `read` | `prepare` | `execute` | `local`
- **Surfaces:** who may invoke it (`mcp` = external agents; `platform` = Finora API; `mobile` = app / local)

**How to read “how it’s used”**

- **Agent** = external MCP client _or_ in-app model when that tool is registered there
- **App** = Expo UI / human
- **API** = `apps/api` implements (often mock today)

---

## Health

| Tool   | Risk | Surfaces      | How it’s used                                                  |
| ------ | ---- | ------------- | -------------------------------------------------------------- |
| `ping` | read | platform, mcp | Liveness. MCP `ping` returns tool count + “prepare only” note. |

---

## Auth & security gates

| Tool                                                     | Risk         | Surfaces         | How it’s used                                             |
| -------------------------------------------------------- | ------------ | ---------------- | --------------------------------------------------------- |
| `create_user`                                            | execute      | platform         | Sign-up / onboarding API. Not MCP.                        |
| `login_user` / `logout_user` / `refresh_session`         | execute      | platform, mobile | Session lifecycle. Agents never own credentials (Vision). |
| `get_current_user` / `update_profile` / `delete_account` | read/execute | platform, mobile | Profile. Not MCP.                                         |
| `enable_biometrics` / `disable_biometrics`               | local        | mobile           | Device Face ID / fingerprint.                             |
| `create_pin` / `verify_pin` / `change_transaction_pin`   | execute      | mobile, platform | Passcode gate before `execute_approved_*`.                |
| `verify_biometric_approval`                              | local        | mobile           | Biometric step in Approvals.                              |
| `verify_transaction_pin`                                 | execute      | mobile, platform | Same human gate as Approvals detail.                      |
| `list_trusted_devices` / `revoke_device`                 | read/execute | platform, mobile | Security settings.                                        |
| `update_security_settings`                               | execute      | mobile, platform | Security prefs screen.                                    |

---

## Provisioning & KYC (WeWire sub-customers)

Used when a human (or ops) onboards an individual/business **before** high limits / certain rails unlock. **Not on curated MCP** — agents shouldn’t drive identity verification.

| Tool                                                        | Risk    | Surfaces | How it’s used                                                                                                          |
| ----------------------------------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `create_financial_account`                                  | prepare | platform | Create WeWire-backed profile (alias `create_subcustomer`).                                                             |
| `get_financial_account` / `list_subcustomers`               | read    | platform | Account list/detail.                                                                                                   |
| `archive_subcustomer` / `update_business_information`       | execute | platform | Admin-style mutations.                                                                                                 |
| `start_kyc` / `submit_kyc` / `submit_kyc_for_review`        | prepare | platform | Start → fill → submit package.                                                                                         |
| `get_kyc_status` / `get_kyc_link` / `list_kyc_requirements` | read    | platform | Progress + hosted link + docs checklist.                                                                               |
| `add_beneficial_owner`                                      | prepare | platform | Business UBO.                                                                                                          |
| Legacy aliases                                              | —       | platform | `create_subcustomer`, `get_subcustomer`, `submit_subcustomer_kyc`, `get_subcustomer_kyc_link`, `get_kyc_requirements`. |

**Product story:** User finishes KYC in app → then MCP `prepare_payment` is allowed under policy.

---

## Wallets & balances

| Tool                                                             | Risk    | Surfaces          | How it’s used                             |
| ---------------------------------------------------------------- | ------- | ----------------- | ----------------------------------------- |
| `get_balances`                                                   | read    | platform, **mcp** | “What’s my balance?” — MCP + chat.        |
| `list_wallets`                                                   | read    | platform, **mcp** | List holdings.                            |
| `get_wallet` / `get_wallet_limits` / `list_supported_currencies` | read    | platform          | Detail / limits / catalog.                |
| `create_wallet` / `freeze_wallet` / `unfreeze_wallet`            | execute | platform          | Wallet admin.                             |
| `prepare_wallet_transfer`                                        | prepare | platform          | Internal move between wallets → approval. |
| `execute_approved_wallet_transfer`                               | execute | platform, mobile  | After PIN.                                |

---

## Virtual accounts & crypto receive

| Tool                                                                      | Risk    | Surfaces         | How it’s used             |
| ------------------------------------------------------------------------- | ------- | ---------------- | ------------------------- |
| `create_virtual_account`                                                  | execute | platform         | Provision VA.             |
| `list_virtual_accounts` / `get_virtual_account`                           | read    | platform         | Receive details.          |
| `share_virtual_account` / `generate_receive_qr`                           | read    | platform, mobile | Share UI.                 |
| `create_crypto_wallet`                                                    | execute | platform         | USDT/USDC wallet.         |
| `get_crypto_wallet` / `list_crypto_addresses` / `validate_wallet_address` | read    | platform         | Addresses + validation.   |
| `prepare_usdt_transfer` / `prepare_usdc_transfer`                         | prepare | platform         | Crypto payout → approval. |
| `execute_approved_crypto_transfer`                                        | execute | platform, mobile | After PIN.                |
| `estimate_network_fee`                                                    | read    | platform         | Fee quote.                |
| `select_blockchain_network`                                               | local   | platform, mobile | UI network picker.        |

---

## Contacts, beneficiaries, recipient resolution

| Tool                                                              | Risk         | Surfaces                        | How it’s used                     |
| ----------------------------------------------------------------- | ------------ | ------------------------------- | --------------------------------- |
| Contact CRUD / favorite / merge / save                            | execute/read | platform (+ mobile where noted) | Address book in app.              |
| Beneficiary CRUD / list / verify                                  | execute/read | platform                        | Payment beneficiaries.            |
| `lookup_*` / `resolve_recipient` / `resolve_duplicate_recipients` | read         | platform                        | Name → account (e.g. two “Ama”s). |
| `search_recipient`                                                | read         | platform, **mcp**               | High-level MCP “find who to pay.” |

Mobile chat today uses a local `resolve_send` wizard (see [mobile.md](./mobile.md)), which maps to the same _idea_ as resolve/search.

Finora Tags are separate from contacts and beneficiaries. `lookup_finora_tag` resolves an account-owned `@tag` to an active Finora sub-customer; the resulting send uses `prepare_internal_transfer`.

---

## Payments (prepare → execute)

| Tool                                                                                | Risk            | Surfaces            | How it’s used                                                       |
| ----------------------------------------------------------------------------------- | --------------- | ------------------- | ------------------------------------------------------------------- |
| `preview_payment` / fee & delivery estimates / verify rails                         | read            | platform            | Quotes before prepare.                                              |
| `prepare_payment`                                                                   | prepare         | platform, **mcp**   | Core agent payout: creates Approvals item. **Does not move money.** |
| `prepare_momo_disbursement` / `prepare_bank_transfer` / `prepare_internal_transfer` | prepare         | platform            | Rail-specific prepares.                                             |
| `execute_approved_payment`                                                          | execute         | platform, mobile    | Human confirmed + PIN → WeWire.                                     |
| `cancel_payment` / `cancel_preparation` / `repeat_payment`                          | execute/prepare | platform (+ mobile) | Cancel or re-prepare.                                               |
| `get_payment_status`                                                                | read            | platform, **mcp**   | Poll status.                                                        |
| `wait_for_payment` / `subscribe_payment_updates` / `list_pending_transfers`         | read/prepare    | platform            | Async / in-flight.                                                  |
| `list_supported_banks` / `list_momo_networks`                                       | read            | platform            | Destination catalogs.                                               |

---

## FX

| Tool                                                   | Risk    | Surfaces          | How it’s used   |
| ------------------------------------------------------ | ------- | ----------------- | --------------- |
| `list_fx_rates` / `get_fx_rate` / `preview_conversion` | read    | platform          | Quotes.         |
| `prepare_conversion`                                   | prepare | platform, **mcp** | FX → Approvals. |
| `execute_approved_conversion`                          | execute | platform, mobile  | After PIN.      |

---

## Receive money

| Tool                                               | Risk            | Surfaces            | How it’s used                                       |
| -------------------------------------------------- | --------------- | ------------------- | --------------------------------------------------- |
| `list_receive_methods`                             | read            | platform            | VA / MoMo / crypto options (also mobile chat demo). |
| `generate_payment_link` / `create_payment_request` | execute/prepare | platform (+ mobile) | Ask-to-pay.                                         |
| `share_receive_details`                            | local           | mobile              | Share sheet.                                        |

---

## Transactions & statements

| Tool                                    | Risk  | Surfaces          | How it’s used             |
| --------------------------------------- | ----- | ----------------- | ------------------------- |
| `list_transactions`                     | read  | platform, **mcp** | History for agents/app.   |
| `get_transaction` / search / filter     | read  | platform          | Detail / Activity screen. |
| `download_receipt` / `export_statement` | read  | platform, mobile  | Exports.                  |
| `share_receipt`                         | local | mobile            | Share sheet.              |

---

## Gmail & invoices

Read-only Gmail tools are available to the platform and MCP: `get_gmail_status`, `search_gmail_messages`, `get_gmail_message`, and `find_gmail_invoices`. Searches are bounded to 20 results; OAuth tokens remain server-side; message content is untrusted data; and attachments are metadata-only.

| Tool                                                    | Risk         | Surfaces            | How it’s used                     |
| ------------------------------------------------------- | ------------ | ------------------- | --------------------------------- |
| `connect_gmail` / `disconnect_gmail` / `sync_emails`    | execute      | platform, mobile    | Integrations screen.              |
| `scan_invoices` / `get_invoice_source_email`            | read         | platform            | “This bill came from invoices@…”. |
| `list_invoices`                                         | read         | platform, **mcp**   | Unpaid supplier bills.            |
| `get_invoice` / ignore / archive / reminder / mark paid | read/execute | platform (+ mobile) | Inbox hygiene.                    |
| `prepare_invoice_payment`                               | prepare      | platform, **mcp**   | Pay invoice → Approvals.          |
| `execute_approved_invoice_payment`                      | execute      | platform, mobile    | After PIN.                        |

---

## Recurring

| Tool                                    | Risk         | Surfaces         | How it’s used        |
| --------------------------------------- | ------------ | ---------------- | -------------------- |
| `prepare_recurring_payment`             | prepare      | platform         | Schedule → approval. |
| `execute_approved_recurring_payment`    | execute      | platform, mobile | Activate after PIN.  |
| list / update / pause / resume / delete | read/execute | platform         | Recurring screen.    |

---

## Business (suppliers, payroll)

Especially for **business** accounts (Vision + plan UI).

| Tool                                                                        | Risk         | Surfaces                | How it’s used                                |
| --------------------------------------------------------------------------- | ------------ | ----------------------- | -------------------------------------------- |
| `list_suppliers` / `list_employees` / `create_employee`                     | read/execute | platform, **mobile**    | Business drawer + chat directory (mock).     |
| `prepare_supplier_payment` / `prepare_payroll` / `prepare_employee_payment` | prepare      | platform (+ mcp/mobile) | Agent/chat prepares; human approves.         |
| `get_treasury_overview` / `list_expenses` / `list_beneficiaries`            | read         | platform, **mobile**    | Treasury, expenses, beneficiaries (mock).    |
| `list_policies` / `list_automations`                                        | read         | platform, **mobile**    | Approval policies + automation rules (mock). |
| `execute_approved_supplier_payment` / `execute_approved_payroll`            | execute      | platform, mobile        | After PIN — **never** MCP execute.           |

---

## Financial plans (multi-item)

| Tool                                                                    | Risk         | Surfaces          | How it’s used                                                 |
| ----------------------------------------------------------------------- | ------------ | ----------------- | ------------------------------------------------------------- |
| `create_financial_plan`                                                 | prepare      | platform, **mcp** | “Pay everything due today” → one Approvals card with N lines. |
| `get_financial_plan` / `list_financial_plans` / `cancel_financial_plan` | read/prepare | platform          | Plan CRUD.                                                    |
| `execute_approved_financial_plan`                                       | execute      | platform, mobile  | Approve-all + PIN.                                            |

UI: Approvals inbox + chat phrase “pay everything due today” (see mobile plan card).

---

## MCP agent transactions (unit of work)

| Tool                   | Risk    | Surfaces          | How it’s used                      |
| ---------------------- | ------- | ----------------- | ---------------------------------- |
| `begin_transaction`    | prepare | platform, **mcp** | Open a batch of related prepares.  |
| `commit_transaction`   | prepare | platform, **mcp** | Finalize → request human approval. |
| `rollback_transaction` | prepare | platform, **mcp** | Cancel preparations in the batch.  |

---

## Notifications

| Tool                              | Risk    | Surfaces                  | How it’s used                                      |
| --------------------------------- | ------- | ------------------------- | -------------------------------------------------- |
| `list_notifications`              | read    | platform, **mcp**, mobile | Agent/app can **read** alerts (“Approval needed”). |
| `mark_notification_read`          | execute | platform, **mobile**      | **App/human** clears unread. Not an MCP tool.      |
| `delete_notification`             | execute | platform, mobile          | App deletes a row.                                 |
| `update_notification_preferences` | execute | mobile, platform          | Settings.                                          |

---

## Approvals engine

| Tool                                                          | Risk         | Surfaces          | How it’s used                                     |
| ------------------------------------------------------------- | ------------ | ----------------- | ------------------------------------------------- |
| `request_approval`                                            | prepare      | platform, **mcp** | Push item into human Approvals inbox.             |
| `create_approval_request` / `list_approvals` / `get_approval` | prepare/read | platform          | Inbox APIs.                                       |
| `approve_transaction` / `reject_transaction`                  | execute      | platform, mobile  | Human decision (still separate from rail settle). |

---

## Policy & audit

| Tool                                                | Risk         | Surfaces          | How it’s used                             |
| --------------------------------------------------- | ------------ | ----------------- | ----------------------------------------- |
| `evaluate_policy`                                   | read         | platform, **mcp** | “Can I prepare this?” before money tools. |
| `check_policy` / `simulate_policy`                  | read         | platform          | Same idea / dry-run.                      |
| `list_policies` / create / update / delete / assign | read/execute | platform          | Policy management UI / admin.             |
| `get_audit_logs`                                    | read         | platform          | Compliance trail.                         |

---

## Capability discovery

| Tool                                                      | Risk | Surfaces          | How it’s used                                         |
| --------------------------------------------------------- | ---- | ----------------- | ----------------------------------------------------- |
| `list_supported_payment_rails` / `_countries` / `_assets` | read | platform, **mcp** | Agents discover what Finora supports (no hardcoding). |
| `list_supported_blockchains` / `_networks`                | read | platform          | Deeper catalogs.                                      |

---

## Events & webhooks (integrators)

| Tool                         | Risk         | Surfaces | How it’s used                        |
| ---------------------------- | ------------ | -------- | ------------------------------------ |
| Event subscribe / list types | prepare/read | platform | Dev integrations.                    |
| Webhook CRUD                 | execute/read | platform | Partner callbacks — not MCP day-one. |

---

## Conversation context & memory

| Tool                                                         | Risk         | Surfaces                  | How it’s used                          |
| ------------------------------------------------------------ | ------------ | ------------------------- | -------------------------------------- |
| `get_recent_context`                                         | read         | platform, **mcp**, mobile | “Send her another 20” → resolve “her.” |
| `get_recent_recipients` / `_transactions` / `resolve_last_*` | read         | platform, mobile          | Pronoun / follow-up helpers.           |
| `remember_*` / `forget_memory` / `list_memories`             | execute/read | platform, mobile          | Learned prefs — app/runtime.           |

---

## Conversations (threads) — mobile local

| Tool                                                              | Risk  | Surfaces   | How it’s used                   |
| ----------------------------------------------------------------- | ----- | ---------- | ------------------------------- |
| `create_conversation` / list / rename / delete / archive / search | local | **mobile** | Thread list UI only. Never MCP. |

---

## Search, integrations, settings

| Tool                                                                                             | Risk          | Surfaces            | How it’s used                             |
| ------------------------------------------------------------------------------------------------ | ------------- | ------------------- | ----------------------------------------- |
| `search_everything` / wallets / invoices / businesses                                            | read          | platform (+ mobile) | Global search.                            |
| Connect Gmail / Calendar / SMS inbox / Drive / WhatsApp / Slack / QuickBooks / disconnect / list | execute/read  | platform, mobile    | Integrations screen (mock connect today). |
| `list_calendar_dues` / `list_sms_requests`                                                       | read          | platform, mobile    | Chat cards for calendar dues & SMS asks.  |
| `change_theme` / `change_language` / `update_settings`                                           | local/execute | mobile (+ platform) | App settings.                             |

---

## Intelligence helpers

| Tool                                                | Risk    | Surfaces         | How it’s used                                       |
| --------------------------------------------------- | ------- | ---------------- | --------------------------------------------------- |
| `summarize_spending` / cash flow / bills / insights | read    | platform, mobile | In-app insights.                                    |
| `recommend_*` / `find_best_*` / `detect_*`          | read    | platform         | Domain reasoning so the model doesn’t invent rails. |
| `categorize_transactions`                           | execute | platform         | Backend labeling.                                   |

---

## Automation

| Tool                                     | Risk         | Surfaces         | How it’s used                                                         |
| ---------------------------------------- | ------------ | ---------------- | --------------------------------------------------------------------- |
| CRUD / pause / resume / list automations | execute/read | platform, mobile | Rules engine.                                                         |
| `execute_automation`                     | execute      | platform, mobile | May **prepare** payments only — still needs human approval to settle. |

---

## See also

- [README.md](./README.md) — tools vs APIs
- [mcp.md](./mcp.md) — curated MCP list only
- [mobile.md](./mobile.md) — chat adapter tools today
