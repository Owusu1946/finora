import {
  CreateMemoryInputSchema,
  ForgetMemoryInputSchema,
  ListMemoriesInputSchema,
  MemorySettingsSchema,
  UpdateMemoryInputSchema,
} from '@finora/shared';
import { Hono } from 'hono';

import type { AppEnv } from '../app-env';

import { refreshMemoryEmbedding } from '../ai/memory-embeddings';
import { createDb } from '../db/client';
import {
  clearUserMemories,
  forgetUserMemory,
  getMemorySettings,
  listUserMemories,
  rememberUserMemory,
  serializeMemory,
  setMemoryEnabled,
  updateUserMemory,
} from '../db/memory-store';

export const memories = new Hono<AppEnv>();

memories.get('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  const query = ListMemoriesInputSchema.safeParse(c.req.query());
  if (!query.success) return c.json({ message: 'Invalid memory query.' }, 400);
  const userId = c.get('auth').userId;
  const db = createDb(c.get('env').DATABASE_URL);
  const [settings, rows] = await Promise.all([
    getMemorySettings(db, userId),
    listUserMemories(db, userId, query.data),
  ]);
  return c.json({ enabled: settings.enabled, memories: rows.map(serializeMemory) });
});

memories.post('/', async (c) => {
  const input = CreateMemoryInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ message: 'Invalid memory.' }, 400);
  const userId = c.get('auth').userId;
  const db = createDb(c.get('env').DATABASE_URL);
  const settings = await getMemorySettings(db, userId);
  if (!settings.enabled) return c.json({ message: 'Memory is disabled.' }, 409);
  const memory = await rememberUserMemory(db, userId, input.data);
  c.executionCtx.waitUntil(
    refreshMemoryEmbedding(db, c.get('env'), userId, memory).catch((error) => {
      console.error('[memory:embedding-write]', {
        memoryId: memory.id,
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }),
  );
  return c.json({ memory: serializeMemory(memory) }, 201);
});

memories.patch('/settings', async (c) => {
  const input = MemorySettingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ message: 'Invalid memory settings.' }, 400);
  const settings = await setMemoryEnabled(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    input.data.enabled,
  );
  return c.json(settings);
});

memories.patch('/:id', async (c) => {
  const input = UpdateMemoryInputSchema.safeParse({
    ...(await c.req.json().catch(() => null)),
    id: c.req.param('id'),
  });
  if (!input.success) return c.json({ message: 'Invalid memory update.' }, 400);
  try {
    const db = createDb(c.get('env').DATABASE_URL);
    const memory = await updateUserMemory(db, c.get('auth').userId, input.data);
    if (memory) {
      c.executionCtx.waitUntil(
        refreshMemoryEmbedding(db, c.get('env'), c.get('auth').userId, memory).catch((error) => {
          console.error('[memory:embedding-write]', {
            memoryId: memory.id,
            errorName: error instanceof Error ? error.name : typeof error,
          });
        }),
      );
    }
    return memory
      ? c.json({ memory: serializeMemory(memory) })
      : c.json({ message: 'Memory not found or conflicts with an existing memory.' }, 409);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      return c.json({ message: 'A matching memory already exists.' }, 409);
    }
    throw error;
  }
});

memories.delete('/:id', async (c) => {
  const input = ForgetMemoryInputSchema.safeParse({ id: c.req.param('id') });
  if (!input.success) return c.json({ message: 'Invalid memory ID.' }, 400);
  const deleted = await forgetUserMemory(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
    input.data.id,
  );
  return deleted ? c.body(null, 204) : c.json({ message: 'Memory not found.' }, 404);
});

memories.delete('/', async (c) => {
  const deleted = await clearUserMemories(
    createDb(c.get('env').DATABASE_URL),
    c.get('auth').userId,
  );
  return c.json({ deleted });
});
