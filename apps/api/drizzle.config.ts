import { getDrizzleDatabaseUrl } from '@finora/env/drizzle';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.dev.vars', quiet: true });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  dbCredentials: { url: getDrizzleDatabaseUrl(process.env) },
  strict: true,
  verbose: true,
});
