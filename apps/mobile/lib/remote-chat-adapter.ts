import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ThreadMessage,
  ThreadMessageLike,
} from '@assistant-ui/react-native';
import type { ChatErrorResponse } from '@finora/shared';

import { ChatErrorResponseSchema, ChatStateResponseSchema } from '@finora/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DefaultChatTransport,
  readUIMessageStream,
  safeValidateUIMessages,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { fetch } from 'expo/fetch';

const RESUMABLE_STREAM_ID_HEADER = 'x-resumable-stream-id';
const BOOTSTRAP_TIMEOUT_MS = 5_000;

type GetToken = () => Promise<string | null>;
type RemoteChatConfig = {
  apiUrl: string;
  chatId: string;
  getToken: GetToken;
};

export type RemoteChatBootstrap = {
  initialMessages: ThreadMessageLike[];
  activeStreamId: string | null;
};

class RemoteChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteChatError';
  }
}

function toUIMessage(message: ThreadMessage): UIMessage {
  return {
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    parts: message.content.flatMap((part) =>
      part.type === 'text' ? [{ type: 'text' as const, text: part.text }] : [],
    ),
  };
}

function messageText(message: UIMessage) {
  return message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
}

function canonicalizeHistory(stored: UIMessage[], local: UIMessage[]) {
  let commonLength = 0;
  while (
    commonLength < stored.length &&
    commonLength < local.length &&
    stored[commonLength]?.role === local[commonLength]?.role &&
    messageText(stored[commonLength]!) === messageText(local[commonLength]!)
  ) {
    commonLength += 1;
  }

  return [...stored.slice(0, commonLength), ...local.slice(commonLength)];
}

function toThreadMessage(message: UIMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.parts.flatMap((part) =>
      part.type === 'text' ? [{ type: 'text' as const, text: part.text }] : [],
    ),
    status: message.role === 'assistant' ? { type: 'complete', reason: 'stop' } : undefined,
  };
}

function activeStreamStorageKey(chatId: string) {
  return `finora:remote-chat:${chatId}:active-stream`;
}

async function persistActiveStreamId(chatId: string, activeStreamId: string | null) {
  const key = activeStreamStorageKey(chatId);
  if (activeStreamId) {
    await AsyncStorage.setItem(key, activeStreamId);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

async function responseError(response: Response) {
  const json: unknown = await response.json().catch(() => null);
  const parsed = ChatErrorResponseSchema.safeParse(json);
  if (parsed.success) return parsed.data;

  return {
    error: {
      code: 'model_unavailable',
      message:
        response.status === 401
          ? 'Your session expired. Please sign in again.'
          : 'Finora AI is temporarily unavailable.',
      requestId: response.headers.get('x-request-id') ?? 'unknown',
      retryable: response.status >= 500,
    },
  } satisfies ChatErrorResponse;
}

function createRemoteChatApi({ apiUrl, chatId, getToken }: RemoteChatConfig) {
  const chatUrl = `${apiUrl}/v1/chat`;

  async function authHeaders() {
    const token = await getToken();
    if (!token) throw new RemoteChatError('Your session expired. Please sign in again.');
    return { Authorization: `Bearer ${token}` };
  }

  async function getState(signal?: AbortSignal) {
    const response = await fetch(`${chatUrl}/${chatId}`, {
      headers: await authHeaders(),
      signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new RemoteChatError((await responseError(response)).error.message);
    const parsed = ChatStateResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new RemoteChatError('Finora returned an invalid chat response.');
    return parsed.data;
  }

  async function stop(activeStreamId: string | null) {
    try {
      const response = await fetch(`${chatUrl}/${chatId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ activeStreamId }),
      });
      if (response.ok) await persistActiveStreamId(chatId, null);
    } catch {
      // Keep the stream ID so a later app launch can reconcile with the server.
    }
  }

  function transport(onStreamId: (streamId: string) => void) {
    return new DefaultChatTransport<UIMessage>({
      api: chatUrl,
      fetch: async (input, init) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const response = await fetch(url, init as Parameters<typeof fetch>[1]);
        const streamId = response.headers.get(RESUMABLE_STREAM_ID_HEADER);
        if (streamId) {
          await persistActiveStreamId(chatId, streamId);
          onStreamId(streamId);
        }
        if (!response.ok) throw new RemoteChatError((await responseError(response)).error.message);
        return response;
      },
    });
  }

  return { authHeaders, getState, stop, transport };
}

async function validateStateMessages(messages: unknown) {
  const validated = await safeValidateUIMessages<UIMessage>({ messages });
  if (!validated.success) throw new RemoteChatError('Finora returned invalid chat history.');
  return validated.data;
}

async function* assistantResults(
  stream: ReadableStream<UIMessageChunk>,
): AsyncGenerator<ChatModelRunResult, UIMessage | undefined> {
  let currentMessage: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream, terminateOnError: true })) {
    currentMessage = message;
    yield { content: [{ type: 'text', text: messageText(message) }] };
  }
  return currentMessage;
}

export async function loadRemoteChatBootstrap(
  config: RemoteChatConfig,
): Promise<RemoteChatBootstrap> {
  const api = createRemoteChatApi(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);
  const [state, storedStreamId] = await Promise.all([
    api.getState(controller.signal),
    AsyncStorage.getItem(activeStreamStorageKey(config.chatId)),
  ]).finally(() => clearTimeout(timeout));
  if (!state) {
    if (storedStreamId) await persistActiveStreamId(config.chatId, null);
    return { initialMessages: [], activeStreamId: null };
  }

  const messages = await validateStateMessages(state.messages);
  const activeStreamId =
    state.active && state.resumable && state.activeStreamId ? state.activeStreamId : null;
  if (storedStreamId !== activeStreamId) {
    await persistActiveStreamId(config.chatId, activeStreamId);
  }

  return {
    initialMessages: messages.map(toThreadMessage),
    activeStreamId,
  };
}

export function createRemoteChatResumeStream(config: RemoteChatConfig, expectedStreamId: string) {
  return async function* ({
    abortSignal,
  }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    const api = createRemoteChatApi(config);
    let activeStreamId = expectedStreamId;
    const transport = api.transport((streamId) => {
      activeStreamId = streamId;
    });
    const onAbort = () => void api.stop(activeStreamId);
    abortSignal.addEventListener('abort', onAbort, { once: true });

    try {
      const stream = await transport.reconnectToStream({
        abortSignal,
        chatId: config.chatId,
        headers: await api.authHeaders(),
      });
      if (!stream) {
        await persistActiveStreamId(config.chatId, null);
        throw new RemoteChatError('The previous response is no longer available. Please retry.');
      }

      yield* assistantResults(stream);
      await persistActiveStreamId(config.chatId, null);
    } catch (error) {
      if (abortSignal.aborted) return;
      throw error;
    } finally {
      abortSignal.removeEventListener('abort', onAbort);
    }
  };
}

export function createRemoteChatAdapter(config: RemoteChatConfig): ChatModelAdapter {
  const api = createRemoteChatApi(config);

  return {
    async *run({ messages, abortSignal }) {
      const uiMessages = messages.filter((message) => message.role !== 'system').map(toUIMessage);
      const state = await api.getState();
      const storedMessages = state ? await validateStateMessages(state.messages) : [];
      const requestMessages = canonicalizeHistory(storedMessages, uiMessages);
      const trigger =
        requestMessages.length === storedMessages.length + 1
          ? ('submit-message' as const)
          : ('regenerate-message' as const);
      let activeStreamId: string | null = null;
      const transport = api.transport((streamId) => {
        activeStreamId = streamId;
      });
      const onAbort = () => void api.stop(activeStreamId);
      abortSignal.addEventListener('abort', onAbort, { once: true });

      try {
        const stream = await transport.sendMessages({
          abortSignal,
          chatId: config.chatId,
          messages: requestMessages,
          trigger,
          messageId: trigger === 'regenerate-message' ? requestMessages.at(-1)?.id : undefined,
          headers: await api.authHeaders(),
        });
        const currentMessage = yield* assistantResults(stream);

        if (!currentMessage && !abortSignal.aborted) {
          throw new RemoteChatError('Finora returned an empty response.');
        }
        await persistActiveStreamId(config.chatId, null);
      } catch (error) {
        if (abortSignal.aborted) return;
        if (!activeStreamId) throw error;

        const resumed = await transport.reconnectToStream({
          abortSignal,
          chatId: config.chatId,
          headers: await api.authHeaders(),
        });
        if (!resumed) throw error;
        yield* assistantResults(resumed);
        await persistActiveStreamId(config.chatId, null);
      } finally {
        abortSignal.removeEventListener('abort', onAbort);
      }
    },
  };
}
