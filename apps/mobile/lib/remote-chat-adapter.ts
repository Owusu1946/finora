import type { ChatModelAdapter, ThreadMessage } from '@assistant-ui/react-native';
import type { ChatErrorResponse } from '@finora/shared';

import { ChatErrorResponseSchema, ChatStateResponseSchema } from '@finora/shared';
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from 'ai';
import { fetch } from 'expo/fetch';

const RESUMABLE_STREAM_ID_HEADER = 'x-resumable-stream-id';

type GetToken = () => Promise<string | null>;

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

function assistantText(message: UIMessage) {
  return message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
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

export function createRemoteChatAdapter({
  apiUrl,
  chatId,
  getToken,
}: {
  apiUrl: string;
  chatId: string;
  getToken: GetToken;
}): ChatModelAdapter {
  const chatUrl = `${apiUrl}/v1/chat`;
  let sessionBaseMessages: UIMessage[] | null = null;

  async function authHeaders() {
    const token = await getToken();
    if (!token) throw new RemoteChatError('Your session expired. Please sign in again.');
    return { Authorization: `Bearer ${token}` };
  }

  async function getState() {
    const response = await fetch(`${chatUrl}/${chatId}`, { headers: await authHeaders() });
    if (response.status === 404) {
      return { messages: [] };
    }
    if (!response.ok) throw new RemoteChatError((await responseError(response)).error.message);
    const parsed = ChatStateResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new RemoteChatError('Finora returned an invalid chat response.');
    return parsed.data;
  }

  async function stop(activeStreamId: string | null) {
    try {
      await fetch(`${chatUrl}/${chatId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ activeStreamId }),
      });
    } catch {
      // The original cancellation still closes the client request.
    }
  }

  return {
    async *run({ messages, abortSignal }) {
      const uiMessages = messages.filter((message) => message.role !== 'system').map(toUIMessage);
      const state = await getState();
      sessionBaseMessages ??= state.messages as UIMessage[];
      const requestMessages = [...sessionBaseMessages, ...uiMessages];
      const trigger =
        requestMessages.length === state.messages.length + 1
          ? ('submit-message' as const)
          : ('regenerate-message' as const);
      let activeStreamId: string | null = null;
      const transport = new DefaultChatTransport<UIMessage>({
        api: chatUrl,
        fetch: async (input, init) => {
          const url =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          const response = await fetch(url, init as Parameters<typeof fetch>[1]);
          activeStreamId = response.headers.get(RESUMABLE_STREAM_ID_HEADER);
          if (!response.ok)
            throw new RemoteChatError((await responseError(response)).error.message);
          return response;
        },
      });
      const onAbort = () => void stop(activeStreamId);
      abortSignal.addEventListener('abort', onAbort, { once: true });

      try {
        const stream = await transport.sendMessages({
          abortSignal,
          chatId,
          messages: requestMessages,
          trigger,
          messageId: trigger === 'regenerate-message' ? requestMessages.at(-1)?.id : undefined,
          headers: await authHeaders(),
        });
        let currentMessage: UIMessage | undefined;
        for await (const message of readUIMessageStream({ stream, terminateOnError: true })) {
          currentMessage = message;
          yield { content: [{ type: 'text', text: assistantText(message) }] };
        }

        if (!currentMessage && !abortSignal.aborted) {
          throw new RemoteChatError('Finora returned an empty response.');
        }
      } catch (error) {
        if (abortSignal.aborted) return;
        if (!activeStreamId) throw error;

        const resumed = await transport.reconnectToStream({
          abortSignal,
          chatId,
          headers: await authHeaders(),
        });
        if (!resumed) throw error;
        for await (const message of readUIMessageStream({
          stream: resumed,
          terminateOnError: true,
        })) {
          yield { content: [{ type: 'text', text: assistantText(message) }] };
        }
      } finally {
        abortSignal.removeEventListener('abort', onAbort);
      }
    },
  };
}
