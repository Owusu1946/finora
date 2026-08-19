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

import { canonicalizeRemoteChatHistory } from './remote-chat-history';

const RESUMABLE_STREAM_ID_HEADER = 'x-resumable-stream-id';
const BOOTSTRAP_TIMEOUT_MS = 5_000;

type GetToken = () => Promise<string | null>;
type RemoteChatConfig = {
  apiUrl: string;
  chatId: string;
  getToken: GetToken;
  isOptimistic?: () => boolean;
  markPersisted?: () => void;
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
  const parts: UIMessage['parts'] = [];
  for (const part of message.content) {
    if (part.type === 'text') {
      parts.push({ type: 'text', text: part.text });
      continue;
    }
    if (message.role !== 'assistant' || part.type !== 'tool-call') continue;

    const input = part.args ?? {};
    if (part.isError) {
      parts.push({
        type: 'dynamic-tool',
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        state: 'output-error',
        input,
        errorText: typeof part.result === 'string' ? part.result : 'Tool execution failed.',
      });
      continue;
    }
    if (part.result !== undefined) {
      parts.push({
        type: 'dynamic-tool',
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        state: 'output-available',
        input,
        output: part.result,
      });
      continue;
    }
    parts.push({
      type: 'dynamic-tool',
      toolName: part.toolName,
      toolCallId: part.toolCallId,
      state: 'input-available',
      input,
    });
  }

  return {
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    parts,
  };
}

type AssistantContent = NonNullable<ChatModelRunResult['content']>;
type ToolCallContent = Extract<AssistantContent[number], { type: 'tool-call' }>;

function asToolArgs(input: unknown): ToolCallContent['args'] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return {};
  return input as ToolCallContent['args'];
}

function toAssistantContent(message: UIMessage): AssistantContent {
  const content: AssistantContent[number][] = [];
  for (const part of message.parts) {
    if (part.type === 'text') {
      content.push({ type: 'text', text: part.text });
      continue;
    }

    const isDynamic = part.type === 'dynamic-tool';
    if (!isDynamic && !part.type.startsWith('tool-')) continue;
    const value = part as typeof part & {
      toolName?: string;
      toolCallId: string;
      state: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
    };
    const toolName = isDynamic ? value.toolName : part.type.slice('tool-'.length);
    if (!toolName) continue;

    const toolCall: ToolCallContent = {
      type: 'tool-call',
      toolCallId: value.toolCallId,
      toolName,
      args: asToolArgs(value.input),
      argsText: JSON.stringify(value.input ?? {}),
      ...(value.state === 'output-available' ? { result: value.output } : {}),
      ...(value.state === 'output-error'
        ? { result: value.errorText ?? 'Tool execution failed.', isError: true }
        : {}),
    };
    content.push(toolCall);
  }
  return content;
}

function toThreadMessage(message: UIMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content:
      message.role === 'assistant'
        ? toAssistantContent(message)
        : message.parts.flatMap((part) =>
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
    const json: unknown = await response.json().catch(() => null);
    const parsed = ChatStateResponseSchema.safeParse(json);
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
        if (!response.ok) throw new RemoteChatError((await responseError(response)).error.message);
        const streamId = response.headers.get(RESUMABLE_STREAM_ID_HEADER);
        if (streamId) {
          await persistActiveStreamId(chatId, streamId).catch(() => undefined);
          onStreamId(streamId);
        }
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
    yield { content: toAssistantContent(message) };
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
      let activeStreamId: string | null = null;
      const transport = api.transport((streamId) => {
        activeStreamId = streamId;
      });
      const onAbort = () => void api.stop(activeStreamId);
      abortSignal.addEventListener('abort', onAbort, { once: true });

      try {
        const uiMessages = messages.filter((message) => message.role !== 'system').map(toUIMessage);
        let state = config.isOptimistic?.() ? null : await api.getState(abortSignal);
        if (state?.active && state.resumable && state.activeStreamId) {
          const resumed = await transport.reconnectToStream({
            abortSignal,
            chatId: config.chatId,
            headers: await api.authHeaders(),
          });
          if (resumed) {
            yield* assistantResults(resumed);
            await persistActiveStreamId(config.chatId, null);
          }
          state = await api.getState(abortSignal);
        }
        const storedMessages = state ? await validateStateMessages(state.messages) : [];
        const requestMessages = canonicalizeRemoteChatHistory(storedMessages, uiMessages);
        const trigger =
          requestMessages.length === storedMessages.length + 1
            ? ('submit-message' as const)
            : ('regenerate-message' as const);
        const stream = await transport.sendMessages({
          abortSignal,
          chatId: config.chatId,
          messages: requestMessages,
          trigger,
          messageId: trigger === 'regenerate-message' ? requestMessages.at(-1)?.id : undefined,
          headers: await api.authHeaders(),
        });
        config.markPersisted?.();
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
