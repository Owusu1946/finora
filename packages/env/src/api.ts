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
      CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
      DEEPGRAM_API_KEY: z.string().min(1).optional(),
      RESEND_API_KEY: z.string().min(1).optional(),
      RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
      WELCOME_EMAIL_MODE: z.enum(['disabled', 'redirect', 'live']).default('disabled'),
      WELCOME_EMAIL_REDIRECT_TO: z.email().optional(),
      WELCOME_EMAIL_FROM: z.string().min(1).default('Finora <welcome@mail.askorin.app>'),
      WELCOME_EMAIL_REPLY_TO: z.email().default('hello@askorin.app'),
      WELCOME_EMAIL_CTA_URL: z.url().default('https://askorin.app'),
      WEWIRE_API_KEY: z.string().min(1).optional(),
      WEWIRE_WEBHOOK_SECRET: z.string().min(1).optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export type ApiEnv = ReturnType<typeof createApiEnv>;
