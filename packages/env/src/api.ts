import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import type { RuntimeEnv } from './runtime-env';

export function createApiEnv(runtimeEnv: RuntimeEnv) {
  return createEnv({
    server: {
      ENVIRONMENT: z.enum(['development', 'preview', 'production']).default('development'),
      DATABASE_URL: z.url(),
      CLERK_SECRET_KEY: z.string().min(1),
      CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
      OPENAI_API_KEY: z.string().min(1).optional(),
      WEWIRE_API_KEY: z.string().min(1).optional(),
      WEWIRE_WEBHOOK_SECRET: z.string().min(1).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export type ApiEnv = ReturnType<typeof createApiEnv>;
