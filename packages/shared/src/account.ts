import { z } from 'zod';

import { FinoraTagSchema } from './finora-tag';
import { GhanaPhoneNumberSchema } from './phone';

export const AccountTypeSchema = z.enum(['personal', 'business']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  accountType: AccountTypeSchema.nullable(),
  finoraTag: FinoraTagSchema.nullable(),
  phoneNumber: GhanaPhoneNumberSchema.nullable(),
  phoneVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateUserProfileSchema = z
  .object({
    accountType: AccountTypeSchema.optional(),
    finoraTag: FinoraTagSchema.optional(),
  })
  .refine((value) => value.accountType !== undefined || value.finoraTag !== undefined, {
    message: 'At least one profile field is required.',
  });
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;

export const FinoraAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  type: AccountTypeSchema,
  displayName: z.string().min(1),
  finoraTag: FinoraTagSchema,
  wewireSubCustomerId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type FinoraAccount = z.infer<typeof FinoraAccountSchema>;
