# WeWire API coverage and adoption plan

This document maps the WeWire reference surface supplied to the project against Finora's product
vision, current server-only client, and intended production architecture.

## Executive summary

Finora is **not currently making live WeWire API calls**. `apps/api` serves in-memory mock data and
must eventually be the only workspace that calls `packages/wewire`. Mobile and MCP must continue to
call the Finora API rather than WeWire directly.

The existing `WewireClient` wraps only part of the reference surface. Its current coverage includes
business and sub-customer wallet listing; sub-customer lifecycle; the beginning of KYC; generic payout,
transaction, transfer, mobile-money disbursement, and FX methods. It does **not** mean those methods
are live: the API route handlers still use mocks.

| Priority             | Meaning                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| **Core**             | Required for the main personal/business account, receive, send, FX, and activity flows.           |
| **Product**          | Required for a complete product area such as beneficiaries, business treasury, or KYC management. |
| **Operations**       | Backend/risk/support control, not exposed directly to agents.                                     |
| **Sandbox/advanced** | Testing or later treasury functionality; not required for the first live release.                 |

`Wrapped` means a typed method exists in `packages/wewire`; it does not mean a Finora route calls it.

## Beneficiaries and accounts

| WeWire operation                       | Priority | Current state                       | Finora use                                     |
| -------------------------------------- | -------- | ----------------------------------- | ---------------------------------------------- |
| List/get beneficiaries                 | Product  | Mock Finora route only              | Saved recipient directory and confirmation.    |
| Create/update/delete beneficiaries     | Product  | Registry/mock concepts; not wrapped | Maintain validated payout recipients.          |
| List/get beneficiary accounts          | Product  | Not wrapped                         | Resolve the exact bank/MoMo destination.       |
| Add/update/delete beneficiary accounts | Product  | Not wrapped                         | Maintain a beneficiary's payout destinations.  |
| List/get accounts                      | Core     | Not wrapped                         | Discover and inspect rail account containers.  |
| Add/update/delete accounts             | Product  | Not wrapped                         | Maintain account destinations where supported. |

Beneficiaries should remain platform/mobile capabilities. MCP may search and prepare a payment, but
should not silently mutate the recipient directory.

## Sub-customers and KYC

| WeWire operation                             | Priority          | Current state                          | Finora use                                                |
| -------------------------------------------- | ----------------- | -------------------------------------- | --------------------------------------------------------- |
| List/get/create/archive sub-customers        | Core              | Wrapped; mock routes exist             | Map Finora personal/business accounts to WeWire profiles. |
| Submit KYC                                   | Core              | Wrapped; mock route exists             | Submit identity/business data.                            |
| Get KYC link                                 | Core              | Wrapped; mock route exists             | Hosted verification flow.                                 |
| Get KYC requirements                         | Core              | Wrapped; mock route exists             | Dynamic onboarding checklist.                             |
| Upload a KYC document                        | Core              | Not wrapped                            | Required document collection/remediation.                 |
| Add/list/get/update/remove beneficial owners | Core for business | Only add is wrapped; mock route exists | Complete UBO management.                                  |
| Submit for review                            | Core              | Wrapped; mock route exists             | Finish onboarding review.                                 |

KYC document upload and full beneficial-owner CRUD are high-priority gaps.

## Accounts, wallets, and receive

| WeWire operation             | Priority              | Current state                       | Finora use                                          |
| ---------------------------- | --------------------- | ----------------------------------- | --------------------------------------------------- |
| Request/list/get an account  | Core                  | Not wrapped                         | Provision and inspect financial rails.              |
| Simulate deposit             | Sandbox               | Not wrapped                         | Sandbox demos/tests only; never production funding. |
| Suspend/reactivate account   | Operations            | Not wrapped                         | Risk/support controls; never MCP.                   |
| Create/list/get wallets      | Core                  | List is wrapped; create/get are not | Balances and funding-source selection.              |
| Issue/list deposit addresses | Core for crypto       | Mock concepts; not wrapped          | Stablecoin receive addresses and QR codes.          |
| Issue/list virtual accounts  | Core for fiat receive | Mock concepts/routes; not wrapped   | USD/EUR/GBP receive details.                        |
| Withdraw from a wallet       | Core execution        | Not wrapped                         | Approved wallet withdrawal.                         |
| List wallet transactions     | Core                  | Generic transaction wrapper only    | Wallet activity and reconciliation.                 |

Wallet withdrawals must remain behind Finora's prepare → policy → human approval → PIN/biometrics →
execute flow.

## Movement, FX, and treasury

| WeWire operation               | Priority          | Current state                            | Finora use                                |
| ------------------------------ | ----------------- | ---------------------------------------- | ----------------------------------------- |
| Preview a conversion           | Core              | Wrapped; mock route exists               | Quote rate, fee, output, and expiry.      |
| Convert between wallets        | Core execution    | Wrapped as `executeConversion`; not live | Execute an approved conversion.           |
| Collect via mobile money       | Core for funding  | Not wrapped                              | “Charge my MoMo” funding flow.            |
| Disburse via mobile money      | Core              | Wrapped; mock prepare route exists       | MoMo payout after approval.               |
| Disburse to a bank account     | Core              | Generic payout wrapper only              | Bank payout after beneficiary validation. |
| Sweep in/out funds             | Advanced treasury | Not wrapped                              | Treasury consolidation/distribution.      |
| Get/update auto-sweep          | Advanced treasury | Not wrapped                              | Business treasury automation.             |
| Transfer between sub-customers | Core              | Wrapped; mock prepare route exists       | Finora Tag/internal transfer.             |

The mocked mobile-money collection flow is a notable implementation gap.

## Business-level wallets

| WeWire operation              | Priority          | Current state                             | Finora use                                          |
| ----------------------------- | ----------------- | ----------------------------------------- | --------------------------------------------------- |
| List wallets                  | Core/operations   | Wrapped as `listBusinessWallets`          | Business treasury/reconciliation.                   |
| List supported assets         | Core              | Finora mock capability route; not wrapped | Live asset discovery instead of hard-coded support. |
| Get/update auto-sweep default | Advanced treasury | Not wrapped                               | Business-level default sweep configuration.         |

## Transactions and rates

| WeWire operation      | Priority       | Current state              | Finora use                                       |
| --------------------- | -------------- | -------------------------- | ------------------------------------------------ |
| Initiate a payout     | Core execution | Wrapped; not live          | Execute an approved payout.                      |
| List/get transactions | Core           | Wrapped; mock routes exist | Activity, status, reporting, and reconciliation. |
| List rates            | Core           | Wrapped; mock route exists | Rate discovery.                                  |
| Get pair rate         | Core           | Wrapped; mock route exists | Requested currency-pair quote.                   |
| Preview a conversion  | Core           | Wrapped; mock route exists | Executable FX quote.                             |

Finora should retain its own preparation, approval, policy, and audit records and store the WeWire
transaction ID as the settlement reference.

## Ghana-specific endpoints

These overlap conceptually with generic lookup, collection, and payout operations. They should be used
when WeWire requires the country-specific route or Ghana-only validation/fields.

| WeWire operation   | Priority       | Current state                    | Finora use                             |
| ------------------ | -------------- | -------------------------------- | -------------------------------------- |
| Look up an account | Core for Ghana | Mock generic lookup only         | Validate a Ghana destination.          |
| Collect a payment  | Core for Ghana | Not wrapped                      | Ghana-local funding/collection.        |
| Pay out            | Core for Ghana | Generic payout/MoMo wrapper only | Ghana-local settlement after approval. |

The Finora API should select either the generic or Ghana-specific adapter for a movement, not call both.

## Adoption plan

### First live integration

1. Sub-customer create/get plus KYC requirements, document upload, owner management, and review.
2. Account request/list/get and wallet create/list/get.
3. Supported assets, virtual accounts, and crypto deposit addresses.
4. Beneficiary and beneficiary-account read/create/update flows.
5. Rate lookup and conversion preview.
6. Transaction list/detail.
7. Payout, MoMo disbursement, bank disbursement, internal transfer, and MoMo collection behind
   Finora approvals.
8. WeWire webhook verification and transaction-status reconciliation.

### Later phases

- Beneficiary deletion and account cleanup.
- Wallet withdrawals beyond the initial send abstractions.
- Sweep in/out and auto-sweep defaults.
- Operational suspend/reactivate controls.
- Expanded Ghana-specific adapters where generic routes are insufficient.

### Sandbox only

- Simulate deposit.

## Architecture rules

- `packages/wewire` is the only WeWire HTTP client.
- Only `apps/api` may import `packages/wewire`.
- Mobile and MCP call Finora API routes, never WeWire.
- WeWire execution endpoints are internal implementation details of Finora's `execute_approved_*`
  handlers.
- MCP receives read and prepare tools only; it never receives WeWire credentials or execution tools.
- Finora owns preparations, approvals, policies, PIN/biometric gates, memory, conversations,
  notifications, plans, and audit records.
- WeWire owns rail-side accounts, wallets, beneficiaries, KYC state, quotes, collections,
  disbursements, transfers, and settled transactions.

## Current wrapper gaps

`packages/wewire` still needs typed methods for beneficiary/account CRUD, KYC document upload and full
beneficial-owner CRUD, sub-customer accounts, wallet creation/detail/deposit addresses/virtual accounts,
withdrawals, mobile-money collection, explicit bank disbursement, supported assets, sweeps/auto-sweep,
and Ghana-specific adapters.

Before adding methods, confirm exact HTTP paths, request/response schemas, pagination, idempotency,
webhook events, and authentication against the current WeWire reference. The operation names above
are reference names, not guessed URL paths.
