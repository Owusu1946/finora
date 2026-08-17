import { createOpenAI } from '@ai-sdk/openai';
import {
  ChatIdSchema,
  ChatRequestSchema,
  ChatStopRequestSchema,
  type ChatErrorResponse,
  type ChatStateResponse,
} from '@finora/shared';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
  UI_MESSAGE_STREAM_HEADERS,
} from 'ai';
import { Hono } from 'hono';

import type { AppEnv } from '../types';

import { fallbackChatTitle, generateAndPersistChatTitle } from '../ai/chat-title';
import { logChatError, toPublicChatError } from '../ai/errors';
import {
  generatedMessagesForPersistence,
  reconcileChatMessages,
  sanitizeIncomingMessages,
} from '../ai/messages';
import { getModelProviderConfig } from '../ai/model-provider';
import { FINORA_SYSTEM_PROMPT } from '../ai/system-prompt';
import {
  closeStreamWith,
  createRedisStreamSession,
  publishStreamCancellation,
} from '../ai/resumable-stream';
import { createChatAgentTools } from '../ai/tools';
import {
  chatIsActive,
  claimChatStream,
  clearChatStream,
  ensureChat,
  finalizeChatStream,
  loadChat,
  replaceChatMessages,
  setFallbackChatTitle,
} from '../db/chat-store';
import { createDb } from '../db/client';

const FIRST_CHUNK_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;
const RESUMABLE_STREAM_ID_HEADER = 'x-resumable-stream-id';
const RESUME_INITIALIZATION_GRACE_MS = 10_000;
const RESUME_RETRY_DELAYS_MS = [0, 100, 200, 400] as const;

export const chat = new Hono<AppEnv>();

async function safetyIdentifier(userId: string) {
  const bytes = new TextEncoder().encode(`finora:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function errorResponse(
  code: ChatErrorResponse['error']['code'],
  message: string,
  requestId: string,
  retryable: boolean,
) {
  return { error: { code, message, requestId, retryable } } satisfies ChatErrorResponse;
}

function logPersistenceError(error: unknown, requestId: string) {
  console.error('[chat:persistence]', {
    requestId,
    errorName: error instanceof Error ? error.name : typeof error,
  });
}

function logRedisError(error: unknown, requestId: string) {
  console.error('[chat:redis]', {
    requestId,
    errorName: error instanceof Error ? error.name : typeof error,
  });
}

async function resumeExistingStream(
  context: Awaited<ReturnType<typeof createRedisStreamSession>>['context'],
  streamId: string,
) {
  for (const delayMs of RESUME_RETRY_DELAYS_MS) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const stream = await context.resumeExistingStream(streamId);
    if (stream) return stream;
  }
  return null;
}

chat.get('/:id/stream', async (c) => {
  const requestId = crypto.randomUUID();
  const parsedId = ChatIdSchema.safeParse(c.req.param('id'));
  if (!parsedId.success) {
    return c.json(
      errorResponse('invalid_request', 'The chat ID is invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }

  const env = c.get('env');
  const db = createDb(env.DATABASE_URL);

  try {
    const { userId } = c.get('auth');
    const stored = await loadChat(db, parsedId.data, userId);
    if (!stored) {
      return c.json(
        errorResponse('chat_not_found', 'The chat was not found.', requestId, false),
        404,
        { 'x-request-id': requestId },
      );
    }

    const active = chatIsActive(stored);
    const activeStreamId = stored.activeStreamId;
    if (!active || !activeStreamId || !stored.activeStreamResumable || !env.REDIS_URL) {
      if (
        activeStreamId &&
        (!active || (stored.activeStreamResumable && env.REDIS_URL === undefined))
      ) {
        await clearChatStream(db, parsedId.data, userId, activeStreamId);
      }
      return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
    }

    let redisSession: Awaited<ReturnType<typeof createRedisStreamSession>>;
    try {
      redisSession = await createRedisStreamSession({
        redisUrl: env.REDIS_URL,
        waitUntil: (promise) => c.executionCtx.waitUntil(promise),
        onError: (error) => logRedisError(error, requestId),
      });
    } catch (error) {
      logRedisError(error, requestId);
      return c.json(
        errorResponse(
          'model_unavailable',
          'The chat stream is temporarily unavailable. Please try again.',
          requestId,
          true,
        ),
        503,
        { 'x-request-id': requestId },
      );
    }

    try {
      const resumedStream = await resumeExistingStream(redisSession.context, activeStreamId);
      if (!resumedStream) {
        await redisSession.close();
        const streamStartedAt = stored.activeStreamStartedAt?.getTime() ?? 0;
        if (streamStartedAt < Date.now() - RESUME_INITIALIZATION_GRACE_MS) {
          await clearChatStream(db, parsedId.data, userId, activeStreamId);
        }
        return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
      }

      return new Response(
        closeStreamWith(resumedStream, redisSession.close).pipeThrough(new TextEncoderStream()),
        {
          headers: {
            ...UI_MESSAGE_STREAM_HEADERS,
            'x-request-id': requestId,
            [RESUMABLE_STREAM_ID_HEADER]: activeStreamId,
          },
        },
      );
    } catch (error) {
      await redisSession.close();
      throw error;
    }
  } catch (error) {
    logChatError(error, requestId);
    const publicChatError = toPublicChatError(error, requestId);
    return c.json(
      errorResponse(
        publicChatError.code,
        publicChatError.message,
        requestId,
        publicChatError.retryable,
      ),
      publicChatError.status,
      { 'x-request-id': requestId },
    );
  }
});

chat.post('/:id/stop', async (c) => {
  const requestId = crypto.randomUUID();
  const parsedId = ChatIdSchema.safeParse(c.req.param('id'));
  if (!parsedId.success) {
    return c.json(
      errorResponse('invalid_request', 'The chat ID is invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parsedBody = ChatStopRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json(
      errorResponse('invalid_request', 'The stop request is invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }

  const env = c.get('env');
  const db = createDb(env.DATABASE_URL);

  try {
    const { userId } = c.get('auth');
    const stored = await loadChat(db, parsedId.data, userId);
    if (!stored) {
      return c.json(
        errorResponse('chat_not_found', 'The chat was not found.', requestId, false),
        404,
        { 'x-request-id': requestId },
      );
    }

    const activeStreamId = stored.activeStreamId;
    if (!activeStreamId || !chatIsActive(stored)) {
      if (activeStreamId) await clearChatStream(db, parsedId.data, userId, activeStreamId);
      return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
    }
    if (parsedBody.data.activeStreamId && parsedBody.data.activeStreamId !== activeStreamId) {
      return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
    }
    if (!stored.activeStreamResumable) {
      return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
    }
    if (!env.REDIS_URL) {
      await clearChatStream(db, parsedId.data, userId, activeStreamId);
      return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
    }

    let listenerCount: number;
    try {
      listenerCount = await publishStreamCancellation(env.REDIS_URL, activeStreamId, (error) =>
        logRedisError(error, requestId),
      );
    } catch (error) {
      logRedisError(error, requestId);
      return c.json(
        errorResponse(
          'model_unavailable',
          'The chat stream could not be stopped. Please try again.',
          requestId,
          true,
        ),
        503,
        { 'x-request-id': requestId },
      );
    }

    if (listenerCount === 0) {
      await clearChatStream(db, parsedId.data, userId, activeStreamId);
    }
    return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
  } catch (error) {
    logChatError(error, requestId);
    const publicChatError = toPublicChatError(error, requestId);
    return c.json(
      errorResponse(
        publicChatError.code,
        publicChatError.message,
        requestId,
        publicChatError.retryable,
      ),
      publicChatError.status,
      { 'x-request-id': requestId },
    );
  }
});

chat.get('/:id', async (c) => {
  const requestId = crypto.randomUUID();
  c.header('Cache-Control', 'no-store');
  const parsedId = ChatIdSchema.safeParse(c.req.param('id'));
  if (!parsedId.success) {
    return c.json(
      errorResponse('invalid_request', 'The chat ID is invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }

  try {
    const { userId } = c.get('auth');
    const stored = await loadChat(createDb(c.get('env').DATABASE_URL), parsedId.data, userId);
    if (!stored) {
      return c.json(
        errorResponse('chat_not_found', 'The chat was not found.', requestId, false),
        404,
        { 'x-request-id': requestId },
      );
    }

    const active = chatIsActive(stored);
    return c.json(
      {
        id: stored.id,
        messages: stored.messages,
        active,
        activeStreamId: active && stored.activeStreamResumable ? stored.activeStreamId : null,
        resumable: active && stored.activeStreamResumable,
        title: stored.title,
        titleStatus: stored.titleStatus,
      } satisfies ChatStateResponse,
      200,
      { 'x-request-id': requestId },
    );
  } catch (error) {
    logChatError(error, requestId);
    const publicChatError = toPublicChatError(error, requestId);
    return c.json(
      errorResponse(
        publicChatError.code,
        publicChatError.message,
        requestId,
        publicChatError.retryable,
      ),
      publicChatError.status,
      { 'x-request-id': requestId },
    );
  }
});

chat.post('/', async (c) => {
  const requestId = crypto.randomUUID();
  const env = c.get('env');
  const provider = getModelProviderConfig(env);
  if (!provider) {
    return c.json(
      errorResponse('model_not_configured', 'The AI service is not configured.', requestId, false),
      503,
      { 'x-request-id': requestId },
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      errorResponse('invalid_request', 'The chat request is invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }

  const validated = await safeValidateUIMessages({ messages: parsed.data.messages });
  if (!validated.success) {
    return c.json(
      errorResponse('invalid_request', 'The chat messages are invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }
  const incomingMessages = sanitizeIncomingMessages(validated.data);
  if (!incomingMessages) {
    return c.json(
      errorResponse('invalid_request', 'The chat messages are invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }

  const { userId } = c.get('auth');
  const db = createDb(env.DATABASE_URL);
  const streamId = crypto.randomUUID();
  const producerAbortController = new AbortController();
  let redisSession: Awaited<ReturnType<typeof createRedisStreamSession>> | null = null;
  let streamClaimed = false;

  try {
    if (!(await ensureChat(db, parsed.data.id, userId))) {
      return c.json(
        errorResponse('chat_conflict', 'This chat ID is unavailable.', requestId, false),
        409,
        { 'x-request-id': requestId },
      );
    }

    if (env.REDIS_URL) {
      try {
        redisSession = await createRedisStreamSession({
          redisUrl: env.REDIS_URL,
          waitUntil: (promise) => c.executionCtx.waitUntil(promise),
          onError: (error) => logRedisError(error, requestId),
        });
        await redisSession.subscribeToCancellation(streamId, () => {
          producerAbortController.abort();
        });
      } catch (error) {
        logRedisError(error, requestId);
        await redisSession?.close();
        redisSession = null;
      }
    }

    streamClaimed = await claimChatStream(
      db,
      parsed.data.id,
      userId,
      streamId,
      redisSession !== null,
    );
    if (!streamClaimed) {
      await redisSession?.close();
      return c.json(
        errorResponse('chat_busy', 'This chat is already generating a response.', requestId, true),
        409,
        { 'x-request-id': requestId },
      );
    }

    const stored = await loadChat(db, parsed.data.id, userId);
    if (!stored) throw new Error('Claimed chat could not be loaded.');
    const messages = reconcileChatMessages(
      stored.messages,
      incomingMessages,
      parsed.data.trigger,
      parsed.data.messageId,
    );
    if (!messages) {
      await clearChatStream(db, parsed.data.id, userId, streamId);
      await redisSession?.close();
      streamClaimed = false;
      return c.json(
        errorResponse(
          'chat_conflict',
          'The chat history is out of date. Reload and try again.',
          requestId,
          true,
        ),
        409,
        { 'x-request-id': requestId },
      );
    }
    const fallbackMessages =
      parsed.data.trigger === 'regenerate-message' ? stored.messages : messages;
    const shouldGenerateTitle =
      parsed.data.trigger === 'submit-message' && stored.messages.length === 0;
    if (parsed.data.trigger === 'submit-message') {
      await replaceChatMessages(db, parsed.data.id, userId, messages);
      if (shouldGenerateTitle) {
        await setFallbackChatTitle(db, parsed.data.id, userId, fallbackChatTitle(messages));
      }
    }

    let errorLogged = false;
    const reportError = (error: unknown) => {
      if (errorLogged) return;
      errorLogged = true;
      logChatError(error, requestId);
    };
    const openai = createOpenAI({
      apiKey: provider.apiKey,
      ...(provider.isOpenRouter
        ? {
            baseURL: 'https://openrouter.ai/api/v1',
            headers: {
              'HTTP-Referer': env.WELCOME_EMAIL_CTA_URL,
              'X-Title': 'Finora',
            },
          }
        : {}),
    });
    const result = streamText({
      model: openai.chat(provider.modelId),
      system: FINORA_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: createChatAgentTools(),
      stopWhen: stepCountIs(5),
      abortSignal: redisSession ? producerAbortController.signal : c.req.raw.signal,
      maxOutputTokens: 2_048,
      maxRetries: 2,
      timeout: {
        firstChunkMs: FIRST_CHUNK_TIMEOUT_MS,
        totalMs: TOTAL_TIMEOUT_MS,
      },
      ...(provider.isOpenRouter
        ? {}
        : {
            providerOptions: {
              openai: {
                reasoningEffort: 'low',
                textVerbosity: 'low',
                store: false,
                safetyIdentifier: await safetyIdentifier(userId),
              },
            },
          }),
      onError: ({ error }) => reportError(error),
    });

    const stream = toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: () => `msg_${crypto.randomUUID().replaceAll('-', '')}`,
      sendReasoning: false,
      onError: (error) => {
        reportError(error);
        return toPublicChatError(error, requestId).message;
      },
      onEnd: ({ messages: generatedMessages }) => {
        const persistence = (async () => {
          try {
            await finalizeChatStream(
              db,
              parsed.data.id,
              userId,
              streamId,
              generatedMessagesForPersistence(generatedMessages, fallbackMessages),
            );
          } catch (error) {
            logPersistenceError(error, requestId);
            try {
              await clearChatStream(db, parsed.data.id, userId, streamId);
            } catch (clearError) {
              logPersistenceError(clearError, requestId);
            }
          }
        })();
        c.executionCtx.waitUntil(persistence);
        if (shouldGenerateTitle) {
          c.executionCtx.waitUntil(
            persistence
              .then(() =>
                generateAndPersistChatTitle({
                  db,
                  chatId: parsed.data.id,
                  userId,
                  messages: generatedMessages,
                  provider,
                  referer: env.WELCOME_EMAIL_CTA_URL,
                }),
              )
              .catch((error) => logPersistenceError(error, requestId)),
          );
        }
        return persistence;
      },
    });

    let resumableStart: Promise<unknown> | undefined;
    const response = createUIMessageStreamResponse({
      stream,
      headers: {
        'x-request-id': requestId,
        ...(redisSession ? { [RESUMABLE_STREAM_ID_HEADER]: streamId } : {}),
      },
      consumeSseStream: redisSession
        ? ({ stream: sseStream }) => {
            resumableStart = redisSession!.createNewResumableStream(streamId, sseStream);
          }
        : undefined,
    });
    await resumableStart;
    return response;
  } catch (error) {
    producerAbortController.abort();
    await redisSession?.close();
    if (streamClaimed) {
      try {
        await clearChatStream(db, parsed.data.id, userId, streamId);
      } catch (clearError) {
        logPersistenceError(clearError, requestId);
      }
    }
    logChatError(error, requestId);
    const publicChatError = toPublicChatError(error, requestId);
    return c.json(
      errorResponse(
        publicChatError.code,
        publicChatError.message,
        requestId,
        publicChatError.retryable,
      ),
      publicChatError.status,
      { 'x-request-id': requestId },
    );
  }
});
