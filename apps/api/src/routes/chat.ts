import { createOpenAI } from '@ai-sdk/openai';
import {
  ChatIdSchema,
  ChatRequestSchema,
  type ChatErrorResponse,
  type ChatStateResponse,
} from '@finora/shared';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from 'ai';
import { Hono } from 'hono';

import type { AppEnv } from '../types';

import { logChatError, toPublicChatError } from '../ai/errors';
import {
  generatedMessagesForPersistence,
  reconcileChatMessages,
  sanitizeIncomingMessages,
} from '../ai/messages';
import {
  chatIsActive,
  claimChatStream,
  clearChatStream,
  ensureChat,
  loadChat,
  replaceChatMessages,
} from '../db/chat-store';
import { createDb } from '../db/client';

const MODEL_ID = 'gpt-5.6-luna';
const FIRST_CHUNK_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;

const FINORA_SYSTEM_PROMPT = `You are Finora, a financial operations assistant.

You may explain financial information and help users review or prepare financial actions. Never claim that unfinished or mocked integrations are live. Never claim that money moved unless the platform explicitly returns a completed execution result.

Money movement must always follow: prepare, policy check, human approval, PIN or biometrics, execute, audit. You cannot bypass approval, request or handle a PIN or biometric secret, or execute a transfer, payment, FX conversion, payroll run, invoice payment, or other money-moving action on your own.

If current account data or an action capability is unavailable, say so plainly. Do not invent balances, transactions, recipients, exchange rates, approvals, or execution results.`;

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
  if (!env.OPENAI_API_KEY) {
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
  let streamClaimed = false;

  try {
    if (!(await ensureChat(db, parsed.data.id, userId))) {
      return c.json(
        errorResponse('chat_conflict', 'This chat ID is unavailable.', requestId, false),
        409,
        { 'x-request-id': requestId },
      );
    }
    streamClaimed = await claimChatStream(db, parsed.data.id, userId, streamId, false);
    if (!streamClaimed) {
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
    await replaceChatMessages(db, parsed.data.id, userId, messages);

    let errorLogged = false;
    const reportError = (error: unknown) => {
      if (errorLogged) return;
      errorLogged = true;
      logChatError(error, requestId);
    };
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const result = streamText({
      model: openai.responses(MODEL_ID),
      system: FINORA_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      abortSignal: c.req.raw.signal,
      maxOutputTokens: 2_048,
      maxRetries: 2,
      timeout: {
        firstChunkMs: FIRST_CHUNK_TIMEOUT_MS,
        totalMs: TOTAL_TIMEOUT_MS,
      },
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          textVerbosity: 'low',
          store: false,
          safetyIdentifier: await safetyIdentifier(userId),
        },
      },
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
            await replaceChatMessages(
              db,
              parsed.data.id,
              userId,
              generatedMessagesForPersistence(generatedMessages, messages),
            );
          } catch (error) {
            logPersistenceError(error, requestId);
          }
          try {
            await clearChatStream(db, parsed.data.id, userId, streamId);
          } catch (error) {
            logPersistenceError(error, requestId);
          }
        })();
        c.executionCtx.waitUntil(persistence);
        return persistence;
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: { 'x-request-id': requestId },
    });
  } catch (error) {
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
