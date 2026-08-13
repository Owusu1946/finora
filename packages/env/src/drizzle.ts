import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import type { RuntimeEnv } from './runtime-env';

export function createDrizzleEnv(runtimeEnv: RuntimeEnv) {
  return createEnv({
    server: {
      DATABASE_URL: z.url().optional(),
      DATABASE_URL_UNPOOLED: z.url().optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export function getDrizzleDatabaseUrl(runtimeEnv: RuntimeEnv) {
  const env = createDrizzleEnv(runtimeEnv);
  const url = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required for drizzle-kit push.');
  }

  return url;
}
