import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

export function createDb(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema });
}

export type Database = ReturnType<typeof createDb>;
