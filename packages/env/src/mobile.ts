import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import type { RuntimeEnv } from './runtime-env';

export function createMobileEnv(runtimeEnv: RuntimeEnv) {
  return createEnv({
    clientPrefix: 'EXPO_PUBLIC_',
    client: {
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
      EXPO_PUBLIC_API_URL: z.url().optional(),
      EXPO_PUBLIC_REMOTE_CHAT_ENABLED: z.enum(['true', 'false']).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export type MobileEnv = ReturnType<typeof createMobileEnv>;
