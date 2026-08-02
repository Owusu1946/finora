import { z } from "zod";

export const AccountTypeSchema = z.enum(["personal", "business"]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const FinoraAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  type: AccountTypeSchema,
  displayName: z.string().min(1),
  wewireSubCustomerId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});
export type FinoraAccount = z.infer<typeof FinoraAccountSchema>;
