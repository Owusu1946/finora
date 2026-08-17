import { z } from 'zod';

export const ChatIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const ChatStreamIdSchema = z.uuid();

export const ChatRequestSchema = z
  .object({
    id: ChatIdSchema,
    messages: z.array(z.unknown()).min(1).max(200),
    trigger: z.enum(['submit-message', 'regenerate-message']),
    messageId: z.string().min(1).max(128).optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatStopRequestSchema = z
  .object({
    activeStreamId: ChatStreamIdSchema.nullish(),
  })
  .strict();
export type ChatStopRequest = z.infer<typeof ChatStopRequestSchema>;

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
  activeStreamId: ChatStreamIdSchema.nullable(),
  resumable: z.boolean(),
  title: z.string().nullable().optional(),
  titleStatus: z.enum(['pending', 'generated', 'fallback']).optional(),
});
export type ChatStateResponse = z.infer<typeof ChatStateResponseSchema>;

export const ChatListItemSchema = z.object({
  id: ChatIdSchema,
  title: z.string().nullable(),
  titleStatus: z.enum(['pending', 'generated', 'fallback']),
  status: z.enum(['regular', 'archived']),
  lastMessageAt: z.string().datetime(),
});
export type ChatListItem = z.infer<typeof ChatListItemSchema>;

export const ChatListResponseSchema = z.object({
  chats: z.array(ChatListItemSchema),
  nextCursor: z.string().nullable(),
});
export type ChatListResponse = z.infer<typeof ChatListResponseSchema>;

export const CreateChatRequestSchema = z
  .object({
    id: ChatIdSchema,
  })
  .strict();

export const UpdateChatRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.archived !== undefined);
