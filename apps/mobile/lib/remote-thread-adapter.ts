import {
  type ChatModelRunOptions,
  ExportedMessageRepository,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
  type ThreadMessage,
} from '@assistant-ui/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAssistantStream, type AssistantStream } from 'assistant-stream';
import * as Crypto from 'expo-crypto';
import { fetch } from 'expo/fetch';

import {
  createRemoteChatAdapter,
  createRemoteChatResumeStream,
  loadRemoteChatBootstrap,
} from './remote-chat-adapter';

const optimisticChatIds = new Set<string>();
const pendingThreadBindings = new Map<string, { current: string | null }>();
const generatedTitles = new Map<string, string>();
const titleRequests = new Map<string, Promise<string | null>>();
const THREAD_LIST_CACHE_TTL_MS = 5_000;
const TITLE_REQUEST_TIMEOUT_MS = 12_000;
const NEW_CHAT_TITLE = 'New chat';
const MAX_TITLE_WORDS = 6;
const MAX_TITLE_LENGTH = 48;
/** Characters revealed per typewriter step, and the delay between steps. */
const TYPEWRITER_CHUNK = 2;
const TYPEWRITER_STEP_MS = 24;

type GetToken = () => Promise<string | null>;

export type RemoteThreadConfig = {
  apiUrl: string;
  userId: string;
  getToken: GetToken;
};

type RemoteThreadMetadata = {
  remoteId: string;
  status: 'regular' | 'archived';
  title?: string;
  lastMessageAt?: Date;
};

function threadCacheKey(userId: string) {
  return `finora:remote-threads:${userId}`;
}

function toMetadata(item: {
  id: string;
  title: string | null;
  titleStatus: 'pending' | 'generated' | 'fallback';
  status: 'regular' | 'archived';
  lastMessageAt: string;
}): RemoteThreadMetadata {
  return {
    remoteId: item.id,
    title: item.title ?? undefined,
    status: item.status,
    lastMessageAt: new Date(item.lastMessageAt),
  };
}

export function firstThreadUserText(messages: readonly ThreadMessage[]) {
  const firstUser = messages.find((message) => message.role === 'user');
  return firstUser?.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function messageText(message: ThreadMessage) {
  return message.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/**
 * Local title from the first words of the first message, matching the API's
 * fallback: no digits (amounts, account numbers) and no ellipsis.
 */
export function fallbackThreadTitle(messages: readonly ThreadMessage[]) {
  const text = firstThreadUserText(messages);
  if (!text) return NEW_CHAT_TITLE;
  let title = '';
  for (const word of text.replaceAll(/["'`]/g, '').split(' ')) {
    if (!word || /\d/.test(word)) continue;
    const next = title ? `${title} ${word}` : word;
    if (next.length > MAX_TITLE_LENGTH || next.split(' ').length > MAX_TITLE_WORDS) break;
    title = next;
  }
  title = title.replace(/[\s.!?:;,…-]+$/u, '');
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : NEW_CHAT_TITLE;
}

export type TitleExchange = { message: string; reply?: string };

/**
 * What a title describes: the user's opening messages (several, so a chat
 * that opened with small talk still gets a topic) and the latest reply.
 */
export function threadTitleExchange(messages: readonly ThreadMessage[]): TitleExchange {
  const userTexts = messages
    .filter((message) => message.role === 'user')
    .slice(0, 3)
    .map(messageText)
    .filter(Boolean);
  const reply = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && messageText(message));
  return {
    message: userTexts.join('\n').slice(0, 1_000),
    reply: reply ? messageText(reply).slice(0, 2_000) : undefined,
  };
}

export function hasGeneratedTitle(remoteId: string) {
  return generatedTitles.has(remoteId);
}

/** Ask the API to title the chat; resolves to the title only once one is generated. */
export async function requestRemoteThreadTitle(
  config: RemoteThreadConfig,
  remoteId: string,
  exchange: TitleExchange,
) {
  const existingRequest = titleRequests.get(remoteId);
  if (existingRequest) return existingRequest;

  const token = await config.getToken();
  if (!token) return null;
  const request = generateTitle(config, remoteId, exchange, token);
  titleRequests.set(remoteId, request);
  return request;
}

async function generateTitle(
  config: RemoteThreadConfig,
  remoteId: string,
  exchange: TitleExchange,
  token: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TITLE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${config.apiUrl}/v1/chats/${encodeURIComponent(remoteId)}/title`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(exchange),
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      title?: unknown;
      titleStatus?: unknown;
    } | null;
    // A fallback means small talk or a model miss; keep "New chat" and retry next turn.
    if (!payload || payload.titleStatus !== 'generated') return null;
    if (typeof payload.title !== 'string' || !payload.title.trim()) return null;
    const title = payload.title.trim();
    generatedTitles.set(remoteId, title);
    return title;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    titleRequests.delete(remoteId);
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Streams a title into the drawer. The runtime updates the title per chunk, so
 * an animated title types itself in; otherwise it appears at once.
 */
function titleAssistantStream(title: string, animate: boolean) {
  return createAssistantStream(async (controller) => {
    if (!animate) {
      controller.appendText(title);
      return;
    }
    for (let index = 0; index < title.length; index += TYPEWRITER_CHUNK) {
      controller.appendText(title.slice(index, index + TYPEWRITER_CHUNK));
      await wait(TYPEWRITER_STEP_MS);
    }
  }) as AssistantStream;
}

async function readCachedThreads(userId: string): Promise<RemoteThreadMetadata[]> {
  const value = await AsyncStorage.getItem(threadCacheKey(userId));
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Parameters<typeof toMetadata>[0] => {
        if (typeof item !== 'object' || item === null) return false;
        const value = item as Record<string, unknown>;
        return (
          typeof value.id === 'string' &&
          (value.title === null || typeof value.title === 'string') &&
          (value.status === 'regular' || value.status === 'archived') &&
          typeof value.lastMessageAt === 'string'
        );
      })
      .map(toMetadata);
  } catch {
    return [];
  }
}

export function createRemoteThreadAdapter(config: RemoteThreadConfig): RemoteThreadListAdapter {
  let cachedList: {
    threads: RemoteThreadMetadata[];
    nextCursor?: string;
    expiresAt: number;
  } | null = null;
  const inFlightLists = new Map<
    string,
    Promise<{ threads: RemoteThreadMetadata[]; nextCursor?: string }>
  >();

  function invalidateListCache() {
    cachedList = null;
  }

  async function headers() {
    const token = await config.getToken();
    if (!token) throw new Error('Your session expired. Please sign in again.');
    return { Authorization: `Bearer ${token}` };
  }

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      body: init?.body ?? undefined,
      headers: { ...init?.headers, ...(await headers()) },
    } as Parameters<typeof fetch>[1]);
    if (!response.ok) throw new Error(`Finora request failed with status ${response.status}.`);
    return response;
  }

  async function loadNetworkList(query: string) {
    const response = await request(`/v1/chats${query}`);
    const payload = (await response.json()) as {
      chats: Array<Parameters<typeof toMetadata>[0]>;
      nextCursor: string | null;
    };
    const threads = payload.chats.map(toMetadata);
    if (!query) {
      cachedList = {
        threads,
        nextCursor: payload.nextCursor ?? undefined,
        expiresAt: Date.now() + THREAD_LIST_CACHE_TTL_MS,
      };
      await AsyncStorage.setItem(threadCacheKey(config.userId), JSON.stringify(payload.chats));
    }
    return { threads, nextCursor: payload.nextCursor ?? undefined };
  }

  return {
    async list(params) {
      const query = params?.after ? `?cursor=${encodeURIComponent(params.after)}` : '';
      const cacheKey = query || 'first-page';
      if (!params?.after && cachedList && cachedList.expiresAt > Date.now()) {
        return { threads: cachedList.threads, nextCursor: cachedList.nextCursor };
      }
      const existing = inFlightLists.get(cacheKey);
      if (existing) return existing;

      if (!params?.after) {
        const persisted = await readCachedThreads(config.userId);
        if (persisted.length > 0) {
          cachedList = {
            threads: persisted,
            expiresAt: Date.now() + THREAD_LIST_CACHE_TTL_MS,
          };
          void loadNetworkList(query).catch(() => undefined);
          return { threads: persisted };
        }
      }

      const load = (async () => {
        try {
          return await loadNetworkList(query);
        } catch (error) {
          const cached = await readCachedThreads(config.userId);
          if (cached.length > 0) return { threads: cached };
          throw error;
        }
      })();
      inFlightLists.set(cacheKey, load);
      try {
        return await load;
      } finally {
        inFlightLists.delete(cacheKey);
      }
    },

    async initialize(localThreadId: string) {
      const remoteId = `chat_${Crypto.randomUUID().replaceAll('-', '')}`;
      optimisticChatIds.add(remoteId);
      const binding = pendingThreadBindings.get(localThreadId);
      if (binding) binding.current = remoteId;
      return { remoteId };
    },

    async fetch(remoteId) {
      const response = await request(`/v1/chats/${encodeURIComponent(remoteId)}`);
      return toMetadata((await response.json()) as Parameters<typeof toMetadata>[0]);
    },

    async rename(remoteId, newTitle) {
      await request(`/v1/chats/${encodeURIComponent(remoteId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      invalidateListCache();
    },

    async archive(remoteId) {
      await request(`/v1/chats/${encodeURIComponent(remoteId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      invalidateListCache();
    },

    async unarchive(remoteId) {
      await request(`/v1/chats/${encodeURIComponent(remoteId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      });
      invalidateListCache();
    },

    async delete(remoteId) {
      await request(`/v1/chats/${encodeURIComponent(remoteId)}`, { method: 'DELETE' });
      invalidateListCache();
      generatedTitles.delete(remoteId);
      titleRequests.delete(remoteId);
      await AsyncStorage.removeItem(threadCacheKey(config.userId));
    },

    async generateTitle(remoteId, messages) {
      // The local fallback shows the instant a message is sent; the generated
      // title types in over it once the API has one.
      const generated = generatedTitles.get(remoteId);
      return generated
        ? titleAssistantStream(generated, true)
        : titleAssistantStream(fallbackThreadTitle(messages), false);
    },
  };
}

export type RemoteThreadRuntimeAdapters = {
  chatModel: ReturnType<typeof createRemoteChatAdapter>;
  history: ThreadHistoryAdapter;
  bindRemoteId: (remoteId: string) => void;
  release: () => void;
};

export function createRemoteThreadRuntimeAdapters(
  config: RemoteThreadConfig,
  localThreadId: string | null,
): RemoteThreadRuntimeAdapters {
  const chatIdRef: { current: string | null } = { current: null };
  const chatConfig = {
    apiUrl: config.apiUrl,
    chatId: '',
    getToken: config.getToken,
    getChatId: () => chatIdRef.current,
    isOptimistic: () => chatIdRef.current !== null && optimisticChatIds.has(chatIdRef.current),
    markPersisted: () => {
      if (chatIdRef.current !== null) optimisticChatIds.delete(chatIdRef.current);
    },
  };
  const history: ThreadHistoryAdapter = {
    async load() {
      const activeChatId = chatIdRef.current;
      if (!activeChatId || optimisticChatIds.has(activeChatId)) return { messages: [] };
      const bootstrap = await loadRemoteChatBootstrap({ ...chatConfig, chatId: activeChatId });
      return {
        ...ExportedMessageRepository.fromArray(bootstrap.initialMessages),
        unstable_resume: bootstrap.activeStreamId !== null,
      };
    },
    async *resume(options: ChatModelRunOptions) {
      const activeChatId = chatIdRef.current;
      if (!activeChatId) return;
      const bootstrap = await loadRemoteChatBootstrap({
        ...chatConfig,
        chatId: activeChatId,
      });
      if (!bootstrap.activeStreamId) return;
      yield* createRemoteChatResumeStream(
        { ...chatConfig, chatId: activeChatId },
        bootstrap.activeStreamId,
      )(options);
    },
    async append() {},
    async update() {},
  };

  if (localThreadId !== null) {
    pendingThreadBindings.set(localThreadId, chatIdRef);
  }

  return {
    chatModel: createRemoteChatAdapter(chatConfig),
    history,
    bindRemoteId(remoteId: string) {
      chatIdRef.current = remoteId;
    },
    release:
      localThreadId !== null
        ? () => {
            pendingThreadBindings.delete(localThreadId);
          }
        : () => {},
  };
}
