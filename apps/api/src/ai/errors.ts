import { APICallError, LoadAPIKeyError, NoSuchModelError } from '@ai-sdk/provider';
import { type ChatErrorCode, type ChatErrorResponse } from '@finora/shared';
import {
  InvalidDataContentError,
  InvalidMessageRoleError,
  MessageConversionError,
  RetryError,
  UIMessageStreamError,
} from 'ai';

type PublicChatError = ChatErrorResponse['error'] & {
  status: 400 | 429 | 500 | 502 | 503 | 504;
};

function apiCallError(error: unknown) {
  if (APICallError.isInstance(error)) return error;
  if (RetryError.isInstance(error)) return apiCallError(error.lastError);
  return null;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function isTimeoutError(error: unknown) {
  if (error instanceof DOMException && error.name === 'TimeoutError') return true;
  if (error instanceof Error && /timeout|timed out/i.test(error.message)) return true;
  const apiError = apiCallError(error);
  return apiError?.statusCode === 408;
}

function publicError(
  requestId: string,
  code: ChatErrorCode,
  status: PublicChatError['status'],
  message: string,
  retryable: boolean,
): PublicChatError {
  return { code, status, message, requestId, retryable };
}

export function toPublicChatError(error: unknown, requestId: string): PublicChatError {
  if (isAbortError(error)) {
    return publicError(requestId, 'invalid_request', 400, 'The chat request was cancelled.', false);
  }
  if (
    InvalidDataContentError.isInstance(error) ||
    InvalidMessageRoleError.isInstance(error) ||
    MessageConversionError.isInstance(error)
  ) {
    return publicError(requestId, 'invalid_request', 400, 'The chat messages are invalid.', false);
  }
  if (LoadAPIKeyError.isInstance(error) || NoSuchModelError.isInstance(error)) {
    return publicError(
      requestId,
      'model_not_configured',
      503,
      'The AI service is not configured.',
      false,
    );
  }

  const apiError = apiCallError(error);
  if (apiError?.statusCode === 401 || apiError?.statusCode === 403) {
    return publicError(
      requestId,
      'model_auth_failed',
      503,
      'The AI service is not configured correctly.',
      false,
    );
  }
  if (apiError?.statusCode === 429) {
    return publicError(
      requestId,
      'model_rate_limited',
      429,
      'The AI service is busy. Please try again shortly.',
      true,
    );
  }
  if (apiError?.statusCode === 404) {
    return publicError(
      requestId,
      'model_not_configured',
      503,
      'The AI service is not configured correctly.',
      false,
    );
  }
  if (apiError?.statusCode === 400 || apiError?.statusCode === 422) {
    return publicError(
      requestId,
      'invalid_request',
      400,
      'The chat request could not be processed.',
      false,
    );
  }
  if (isTimeoutError(error)) {
    return publicError(
      requestId,
      'model_timeout',
      504,
      'The AI service took too long to respond. Please try again.',
      true,
    );
  }
  if (
    RetryError.isInstance(error) ||
    (apiError !== null && (apiError.isRetryable || (apiError.statusCode ?? 0) >= 500))
  ) {
    return publicError(
      requestId,
      'model_unavailable',
      503,
      'The AI service is temporarily unavailable. Please try again.',
      true,
    );
  }
  if (UIMessageStreamError.isInstance(error)) {
    return publicError(
      requestId,
      'model_unavailable',
      502,
      'The AI response could not be completed. Please try again.',
      true,
    );
  }
  return publicError(
    requestId,
    'internal_error',
    500,
    'Something went wrong. Please try again.',
    false,
  );
}

export function logChatError(error: unknown, requestId: string) {
  if (isAbortError(error)) return;
  const publicChatError = toPublicChatError(error, requestId);
  console.error('[chat]', {
    requestId,
    code: publicChatError.code,
    errorName: error instanceof Error ? error.name : typeof error,
    statusCode: apiCallError(error)?.statusCode,
  });
}
