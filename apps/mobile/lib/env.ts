import { createMobileEnv } from '@finora/env/mobile';

export const env = createMobileEnv({
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_REMOTE_CHAT_ENABLED: process.env.EXPO_PUBLIC_REMOTE_CHAT_ENABLED,
});
