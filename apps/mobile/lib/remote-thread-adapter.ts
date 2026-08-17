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

import type { RemoteChatBootstrap } from './remote-chat-adapter';

import {
  createRemoteChatAdapter,
  createRemoteChatResumeStream,
  loadRemoteChatBootstrap,
} from './remote-chat-adapter';

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

function fallbackTitle(messages: readonly ThreadMessage[]) {
  const firstUser = messages.find((message) => message.role === 'user');
  const text = firstUser?.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (!text) return 'New chat';
  const words = text.split(' ').slice(0, 7).join(' ');
  return words.length > 60 ? `${words.slice(0, 57).trim()}...` : words;
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

  return {
    async list(params) {
      try {
        const query = params?.after ? `?cursor=${encodeURIComponent(params.after)}` : '';
        const response = await request(`/v1/chats${query}`);
        const payload = (await response.json()) as {
          chats: Array<Parameters<typeof toMetadata>[0]>;
          nextCursor: string | null;
        };
        const threads = payload.chats.map(toMetadata);
        if (!params?.after) {
          await AsyncStorage.setItem(threadCacheKey(config.userId), JSON.stringify(payload.chats));
        }
        return { threads, nextCursor: payload.nextCursor ?? undefined };
      } catch (error) {
        const cached = await readCachedThreads(config.userId);
        if (cached.length > 0) return { threads: cached };
        throw error;
      }
    },

    async initialize() {
      const id = `chat_${Crypto.randomUUID().replaceAll('-', '')}`;
      const response = await request('/v1/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const metadata = toMetadata((await response.json()) as Parameters<typeof toMetadata>[0]);
      return { remoteId: metadata.remoteId };
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
    },

    async archive(remoteId) {
      await request(`/v1/chats/${encodeURIComponent(remoteId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
    },

    async unarchive(remoteId) {
      await request(`/v1/chats/${encodeURIComponent(remoteId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      });
    },

    async delete(remoteId) {
      await request(`/v1/chats/${encodeURIComponent(remoteId)}`, { method: 'DELETE' });
      await AsyncStorage.removeItem(threadCacheKey(config.userId));
    },

    async generateTitle(_remoteId, messages) {
      return titleAssistantStream(fallbackTitle(messages));
    },
  };
}

export function createRemoteThreadRuntimeAdapters(config: RemoteThreadConfig, chatId: string) {
  const chatConfig = { apiUrl: config.apiUrl, chatId, getToken: config.getToken };
  const history: ThreadHistoryAdapter = {
    async load() {
      if (chatId === 'pending') return { messages: [] };
      const bootstrap = await loadRemoteChatBootstrap(chatConfig);
      return {
        ...ExportedMessageRepository.fromArray(bootstrap.initialMessages),
        unstable_resume: bootstrap.activeStreamId !== null,
      };
    },
    async *resume(options: ChatModelRunOptions) {
      const bootstrap: RemoteChatBootstrap = await loadRemoteChatBootstrap(chatConfig);
      if (!bootstrap.activeStreamId) return;
      yield* createRemoteChatResumeStream(chatConfig, bootstrap.activeStreamId)(options);
    },
    async append() {},
    async update() {},
  };
  return {
    chatModel: createRemoteChatAdapter(chatConfig),
    history,
  };
}
