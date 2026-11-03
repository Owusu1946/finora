---
name: finora-mobile
description: Route all work in Finora's apps/mobile Expo app. Use for any change, review, dependency update, or debugging task under apps/mobile, especially Expo SDK 57, NativeWind v5 preview, @assistant-ui/react-native, Metro, routing, native modules, or mobile package compatibility.
---

# Finora mobile

Use this repository router before the relevant upstream Expo or assistant-ui skill. Keep the upstream skill as the implementation reference, then apply the constraints below.

## Pin Expo guidance to SDK 57

- Read apps/mobile/package.json before choosing APIs or package versions. This app stays on Expo SDK 57 until the user requests a separate upgrade.
- Use https://docs.expo.dev/versions/v57.0.0/, never latest, for Expo API behavior. If an upstream skill describes an SDK 58+ feature, do not use it here.
- Install Expo packages with pnpm --filter @finora/mobile exec expo install. Verify with expo install --check and pnpm dlx expo-doctor@latest apps/mobile.
- Preserve react and react-dom at 19.2.3, react-native at 0.86.3, and the single-React aliases in apps/mobile/metro.config.js.
- Keep expo-asset at the SDK 57 line because it is a direct expo-audio peer.
- Do not import `@react-navigation/*`. SDK 57 vendors React Navigation inside expo-router: use `expo-router` (themes, `useIsFocused`), `expo-router/drawer` (drawer hooks and types), and `expo-router/react-navigation` for the rest.

Current compatibility matrix:

| Package                       | Finora constraint        |
| ----------------------------- | ------------------------ |
| expo                          | ~57.0.31                 |
| react / react-dom             | 19.2.3                   |
| react-native                  | 0.86.3                   |
| expo-audio / expo-asset       | ~57.0.5 / ~57.0.20       |
| expo-router                   | ~57.0.29                 |
| @assistant-ui/react-native    | 0.1.35                   |
| ai / assistant-stream         | 7.0.65 / 0.3.39          |
| nativewind / react-native-css | 5.0.0-preview.4 / ^3.0.7 |

## Use the native assistant-ui package

- Import runtime hooks, primitives, types, and makeAssistantToolUI from @assistant-ui/react-native. Do not copy @assistant-ui/react, DOM, Next.js, shadcn, or @assistant-ui/react-markdown examples into mobile.
- Treat the generic runtime, primitives, tools, markdown, and update skills as web guidance unless their example explicitly targets React Native. Prefer the installed package README and https://www.assistant-ui.com/docs/react-native.
- The React Native MessagePrimitive.Parts and composer APIs may differ from the web package. Check the installed 0.1.35 types before migrating a web deprecation.
- makeAssistantToolUI render callbacks are React component boundaries in this package. Use a named function and call hooks at its top level. Do not extract hook calls into the object initializer or conditional branches.
- Preserve the remote runtime pattern in apps/mobile/app/_layout.tsx and apps/mobile/lib/remote-thread-adapter.ts. Mobile never imports WeWire and never turns a prepare tool into direct execution.

## Route to upstream skills

- Load expo-overview first for Expo work, then its selected leaf skill. Apply the SDK 57 gate above to every recommendation.
- Load expo-upgrade only when the user explicitly requests an Expo SDK change.
- Load the generic assistant-ui skill only for architecture shared with React Native. Use installed native types for final API decisions.
