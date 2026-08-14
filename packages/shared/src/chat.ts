import { z } from 'zod';

export const ChatIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const ChatRequestSchema = z
  .object({
    id: ChatIdSchema,
    messages: z.array(z.unknown()).min(1).max(200),
    trigger: z.enum(['submit-message', 'regenerate-message']),
    messageId: z.string().min(1).max(128).optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatErrorCodeSchema = z.enum([
  'chat_busy',
  'chat_conflict',
  'chat_not_found',
  'invalid_request',
  'model_not_configured',
  'model_auth_failed',
  'model_rate_limited',
  'model_timeout',
  'model_unavailable',
  'internal_error',
]);
export type ChatErrorCode = z.infer<typeof ChatErrorCodeSchema>;

export const ChatErrorResponseSchema = z.object({
  error: z.object({
    code: ChatErrorCodeSchema,
    message: z.string(),
    requestId: z.string().min(1),
    retryable: z.boolean(),
  }),
});
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>;

export const ChatStateResponseSchema = z.object({
  id: ChatIdSchema,
  messages: z.array(z.unknown()),
  active: z.boolean(),
  activeStreamId: z.string().nullable(),
  resumable: z.boolean(),
});
export type ChatStateResponse = z.infer<typeof ChatStateResponseSchema>;
