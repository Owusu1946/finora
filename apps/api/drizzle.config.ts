import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.dev.vars', quiet: true });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required for migrations.');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
