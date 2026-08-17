# @finora/mobile

Conversation-first Finora mobile app built with Expo SDK 54.

## Stack

- Expo Router drawer shell
- `@assistant-ui/react-native` Thread / Composer / Message / ThreadList
- NativeWind v5 styling
- Finora API chat transport with mocked or stubbed financial capabilities where noted

## Scripts

Run commands from the repository root:

| Command                                    | Expected result                                                    |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `pnpm dev:mobile`                          | Starts Metro, normally on port `8081`, and prints an Expo QR code. |
| `pnpm android`                             | Starts Metro and opens or prompts for an Android emulator/device.  |
| `pnpm ios`                                 | Starts Metro and opens an iOS simulator when the host supports it. |
| `pnpm --filter @finora/mobile web`         | Starts the Expo web target.                                        |
| `pnpm --filter @finora/mobile lint`        | Runs Expo ESLint for the mobile package.                           |
| `pnpm --filter @finora/mobile check-types` | Runs TypeScript without emitting files.                            |

`dev:mobile` is included in the root `pnpm dev` session, which also starts the phone-facing LAN
proxy. The app derives `http://<COMPUTER_LAN_IP>:8788` from Metro while the API itself remains
bound to loopback on port `8787`. When starting services individually, run `pnpm dev:api`,
`pnpm dev:lan`, and `pnpm dev:mobile`.
