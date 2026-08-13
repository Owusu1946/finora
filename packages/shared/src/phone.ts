import { z } from 'zod';

export const GhanaPhoneNumberSchema = z.string().regex(/^\+233\d{9}$/);
export const PhoneVerificationCodeSchema = z.string().regex(/^\d{6}$/);

export function normalizeGhanaPhoneNumber(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const digits = compact.replace(/\D/g, '');
  const normalized = compact.startsWith('+233')
    ? `+233${digits.slice(3)}`
    : digits.startsWith('233')
      ? `+${digits}`
      : digits.startsWith('0')
        ? `+233${digits.slice(1)}`
        : digits.length === 9
          ? `+233${digits}`
          : null;

  const parsed = GhanaPhoneNumberSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}
