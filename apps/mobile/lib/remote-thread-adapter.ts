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
const TITLE_REQUEST_TIMEOUT_MS = 20_000;

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

export function fallbackThreadTitle(messages: readonly ThreadMessage[]) {
  const text = firstThreadUserText(messages);
  if (!text) return 'New chat';
  const words = text.split(' ').slice(0, 7).join(' ');
  return words.length > 60 ? `${words.slice(0, 57).trim()}...` : words;
}

export async function requestRemoteThreadTitle(
  config: RemoteThreadConfig,
  remoteId: string,
  message: string,
) {
  const existingRequest = titleRequests.get(remoteId);
  if (existingRequest) return existingRequest;

  const token = await config.getToken();
  if (!token) return null;
  const request = generateTitle(config, remoteId, message, token);
  titleRequests.set(remoteId, request);
  return request;
}

async function generateTitle(
  config: RemoteThreadConfig,
  remoteId: string,
  message: string,
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
        body: JSON.stringify({ message }),
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { title?: unknown } | null;
    if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) return null;
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

function titleAssistantStream(title: string) {
  return createAssistantStream((controller) => controller.appendText(title)) as AssistantStream;
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
      const title = generatedTitles.get(remoteId) ?? fallbackThreadTitle(messages);
      return titleAssistantStream(title);
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
