# `@finora/wewire`

Server-only typed client for WeWire HTTP APIs. Used by `apps/api` only — never import from mobile or MCP.

## Methods (grouped)

| Group         | Methods                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Wallets       | `listBusinessWallets`, `listSubCustomerWallets`                                                                   |
| Sub-customers | `createSubCustomer`, `listSubCustomers`, `getSubCustomer`, `archiveSubCustomer`                                   |
| KYC           | `submitSubCustomerKyc`, `getSubCustomerKycLink`, `getKycRequirements`, `addBeneficialOwner`, `submitKycForReview` |
| Payouts       | `initiatePayout`                                                                                                  |
| Transactions  | `listTransactions`, `getTransaction`                                                                              |
| Transfers     | `transfer`                                                                                                        |
| MoMo          | `disburseMobileMoney`                                                                                             |
| FX            | `listRates`, `getPairRate`, `previewConversion`, `executeConversion`                                              |

Finora API currently serves **mock** responses; swap route handlers to call this client when sandbox keys are ready.

## Verification

```bash
# from the repository root
pnpm --filter @finora/wewire check-types
```

The root `pnpm check-types` command includes this package automatically. This server-only library
has no standalone dev server or build output.
