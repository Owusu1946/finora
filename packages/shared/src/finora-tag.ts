import { z } from 'zod';

export const FINORA_TAG_MIN_LENGTH = 3;
export const FINORA_TAG_MAX_LENGTH = 24;

export function normalizeFinoraTag(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, FINORA_TAG_MAX_LENGTH);
}

export const FinoraTagSchema = z
  .string()
  .transform(normalizeFinoraTag)
  .pipe(
    z
      .string()
      .min(FINORA_TAG_MIN_LENGTH)
      .max(FINORA_TAG_MAX_LENGTH)
      .regex(/^[a-z][a-z0-9_]*$/),
  );

export const FinoraTagAccountSchema = z.object({
  accountId: z.string().min(1),
  subCustomerId: z.string().min(1),
  tag: FinoraTagSchema,
  displayName: z.string().min(1),
  country: z.string().length(2),
  status: z.enum(['active', 'suspended']),
  walletCurrencies: z.array(z.string().min(3)).min(1),
});

export type FinoraTagAccount = z.infer<typeof FinoraTagAccountSchema>;
