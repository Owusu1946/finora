import { z } from 'zod';

export const MemoryKindSchema = z.enum(['preference', 'contact', 'supplier', 'note']);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

export const MemorySchema = z.object({
  id: z.uuid(),
  kind: MemoryKindSchema,
  title: z.string(),
  content: z.string(),
  source: z.literal('explicit'),
  sourceChatId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FinoraMemory = z.infer<typeof MemorySchema>;

export const MemorySettingsSchema = z.object({ enabled: z.boolean() });

function containsSensitiveMemoryData(value: string) {
  return (
    /\b(pin|password|passcode|otp|one[- ]time password|api key|private key|recovery code|secret)\b/i.test(value) ||
    /\d{8,}/.test(value.replaceAll(/[\s()+-]/g, ''))
  );
}

const SafeMemoryTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !containsSensitiveMemoryData(value), 'Sensitive data cannot be stored in memory.');
const SafeMemoryContentSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_000)
  .refine((value) => !containsSensitiveMemoryData(value), 'Sensitive data cannot be stored in memory.');

export const MemoryListResponseSchema = z.object({
  enabled: z.boolean(),
  memories: z.array(MemorySchema),
});
export type MemoryListResponse = z.infer<typeof MemoryListResponseSchema>;

export const CreateMemoryInputSchema = z
  .object({
    kind: MemoryKindSchema,
    title: SafeMemoryTitleSchema,
    content: SafeMemoryContentSchema,
  })
  .strict();
export type CreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>;
export const RememberMemoryDetailsInputSchema = CreateMemoryInputSchema.omit({ kind: true });

export const UpdateMemoryInputSchema = z
  .object({
    id: z.uuid(),
    kind: MemoryKindSchema.optional(),
    title: SafeMemoryTitleSchema.optional(),
    content: SafeMemoryContentSchema.optional(),
  })
  .strict()
  .refine((value) => value.kind !== undefined || value.title !== undefined || value.content !== undefined, {
    message: 'At least one memory field is required.',
  });
export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInputSchema>;

export const ListMemoriesInputSchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    kind: MemoryKindSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const ForgetMemoryInputSchema = z.object({ id: z.uuid() }).strict();
