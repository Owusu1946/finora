import {
  ChatIdSchema,
  CreateChatRequestSchema,
  UpdateChatRequestSchema,
  type ChatListResponse,
} from '@finora/shared';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app-env';

import {
  deleteChat,
  ensureChat,
  getChatMetadata,
  listChats,
  updateChatMetadata,
} from '../db/chat-store';
import { createDb } from '../db/client';

const ListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

function encodeCursor(value: { updatedAt: Date; id: string }) {
  return btoa(JSON.stringify([value.updatedAt.toISOString(), value.id]))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function decodeCursor(value: string | undefined) {
  if (!value) return undefined;
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed: unknown = JSON.parse(atob(padded));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [timestamp, id] = parsed;
    if (typeof timestamp !== 'string' || typeof id !== 'string') return null;
    const updatedAt = new Date(timestamp);
    if (Number.isNaN(updatedAt.getTime()) || !ChatIdSchema.safeParse(id).success) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

function metadataResponse(chat: NonNullable<Awaited<ReturnType<typeof getChatMetadata>>>) {
  return {
    id: chat.id,
    title: chat.title,
    titleStatus: chat.titleStatus,
    status: chat.archivedAt ? ('archived' as const) : ('regular' as const),
    lastMessageAt: chat.updatedAt.toISOString(),
  };
}

export const chats = new Hono<AppEnv>();

chats.get('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  const query = ListQuerySchema.safeParse(c.req.query());
  if (!query.success) return c.json({ message: 'Invalid chat list query.' }, 400);
  const cursor = decodeCursor(query.data.cursor);
  if (cursor === null) return c.json({ message: 'Invalid chat cursor.' }, 400);

  const { userId } = c.get('auth');
  const db = createDb(c.get('env').DATABASE_URL);
  const rows = await listChats(db, userId, {
    limit: query.data.limit,
    cursor,
  });
  const hasMore = rows.length > query.data.limit;
  const page = rows.slice(0, query.data.limit);
  const last = page.at(-1);
  return c.json({
    chats: page.map(metadataResponse),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  } satisfies ChatListResponse);
});

chats.post('/', async (c) => {
  const parsed = CreateChatRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ message: 'Invalid chat request.' }, 400);
  const { userId } = c.get('auth');
  const db = createDb(c.get('env').DATABASE_URL);
  if (!(await ensureChat(db, parsed.data.id, userId))) {
    return c.json({ message: 'This chat ID is unavailable.' }, 409);
  }
  const chat = await getChatMetadata(db, parsed.data.id, userId);
  if (!chat) return c.json({ message: 'Could not create chat.' }, 500);
  return c.json(metadataResponse(chat), 201);
});

chats.get('/:id', async (c) => {
  c.header('Cache-Control', 'no-store');
  const id = ChatIdSchema.safeParse(c.req.param('id'));
  if (!id.success) return c.json({ message: 'Invalid chat ID.' }, 400);
  const chat = await getChatMetadata(
    createDb(c.get('env').DATABASE_URL),
    id.data,
    c.get('auth').userId,
  );
  return chat ? c.json(metadataResponse(chat)) : c.json({ message: 'Chat not found.' }, 404);
});

chats.patch('/:id', async (c) => {
  const id = ChatIdSchema.safeParse(c.req.param('id'));
  const body = UpdateChatRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return c.json({ message: 'Invalid chat update.' }, 400);
  const updated = await updateChatMetadata(
    createDb(c.get('env').DATABASE_URL),
    id.data,
    c.get('auth').userId,
    body.data,
  );
  return updated ? c.body(null, 204) : c.json({ message: 'Chat not found.' }, 404);
});

chats.delete('/:id', async (c) => {
  const id = ChatIdSchema.safeParse(c.req.param('id'));
  if (!id.success) return c.json({ message: 'Invalid chat ID.' }, 400);
  const deleted = await deleteChat(
    createDb(c.get('env').DATABASE_URL),
    id.data,
    c.get('auth').userId,
  );
  return deleted ? c.body(null, 204) : c.json({ message: 'Chat not found.' }, 404);
});
