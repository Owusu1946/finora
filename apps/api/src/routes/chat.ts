import { createOpenAI } from '@ai-sdk/openai';
import { ChatRequestSchema, type ChatErrorResponse } from '@finora/shared';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
import { Hono } from 'hono';

import type { AppEnv } from '../types';

import { logChatError, toPublicChatError } from '../ai/errors';

const MODEL_ID = 'gpt-5.6-luna';
const FIRST_CHUNK_TIMEOUT_MS = 30_000;
const MAX_CHAT_TEXT_LENGTH = 120_000;
const TOTAL_TIMEOUT_MS = 120_000;

const FINORA_SYSTEM_PROMPT = `You are Finora, a financial operations assistant.

You may explain financial information and help users review or prepare financial actions. Never claim that unfinished or mocked integrations are live. Never claim that money moved unless the platform explicitly returns a completed execution result.

Money movement must always follow: prepare, policy check, human approval, PIN or biometrics, execute, audit. You cannot bypass approval, request or handle a PIN or biometric secret, or execute a transfer, payment, FX conversion, payroll run, invoice payment, or other money-moving action on your own.

If current account data or an action capability is unavailable, say so plainly. Do not invent balances, transactions, recipients, exchange rates, approvals, or execution results.`;

export const chat = new Hono<AppEnv>();

function messagesAreAllowed(messages: UIMessage[]) {
  const messageIds = new Set<string>();
  let textLength = 0;

  for (const message of messages) {
    if (messageIds.has(message.id)) return false;
    messageIds.add(message.id);
    if (message.role !== 'user' && message.role !== 'assistant') return false;

    let hasText = false;
    for (const part of message.parts) {
      if (part.type === 'text') {
        textLength += part.text.length;
        hasText ||= part.text.trim().length > 0;
        continue;
      }
      if (message.role === 'assistant' && part.type === 'step-start') continue;
      return false;
    }
    if (!hasText) return false;
  }

  return messages.at(-1)?.role === 'user' && textLength <= MAX_CHAT_TEXT_LENGTH;
}

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
  if (!messagesAreAllowed(validated.data)) {
    return c.json(
      errorResponse('invalid_request', 'The chat messages are invalid.', requestId, false),
      400,
      { 'x-request-id': requestId },
    );
  }

  try {
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
      messages: await convertToModelMessages(validated.data),
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
          safetyIdentifier: await safetyIdentifier(c.get('auth').userId),
        },
      },
      onError: ({ error }) => reportError(error),
    });

    const stream = toUIMessageStream({
      stream: result.stream,
      originalMessages: validated.data,
      sendReasoning: false,
      onError: (error) => {
        reportError(error);
        return toPublicChatError(error, requestId).message;
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: { 'x-request-id': requestId },
    });
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
