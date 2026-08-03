import { setAuthSession } from '@/lib/auth-storage';

/**
 * Mock auth helpers shaped for a later Better Auth swap.
 *
 * Email verification OTP:
 *   authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })
 *   authClient.emailOtp.verifyEmail({ email, otp })
 *
 * Password reset OTP:
 *   authClient.emailOtp.requestPasswordReset({ email })
 *   authClient.emailOtp.checkVerificationOtp({ email, type: "forget-password", otp }) // optional
 *   authClient.emailOtp.resetPassword({ email, otp, password })
 *
 * Default Better Auth otpLength is 6.
 */

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export type OtpPurpose = 'email-verification' | 'forget-password';

/** Mock OTP shown only in __DEV__ logs / UI hints. */
export const MOCK_EMAIL_OTP = '123456';

const pendingOtps = new Map<string, string>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function otpKey(email: string, purpose: OtpPurpose) {
  return `${purpose}:${normalizeEmail(email)}`;
}

function storeOtp(email: string, purpose: OtpPurpose) {
  const normalized = normalizeEmail(email);
  pendingOtps.set(otpKey(normalized, purpose), MOCK_EMAIL_OTP);
  if (__DEV__) {
    console.log(`[Finora Auth] mock ${purpose} OTP for ${normalized}: ${MOCK_EMAIL_OTP}`);
  }
}

function readOtp(email: string, purpose: OtpPurpose) {
  return pendingOtps.get(otpKey(email, purpose)) ?? MOCK_EMAIL_OTP;
}

export async function signInEmail(email: string, password: string): Promise<AuthResult> {
  await delay(650);
  if (!email.trim() || !password) {
    return { ok: false, error: 'Enter email and password.' };
  }
  await setAuthSession();
  return { ok: true };
}

/** Registers locally; does not create a session until email OTP is verified. */
export async function signUpEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  await delay(700);
  if (!input.email.trim() || !input.password) {
    return { ok: false, error: 'Enter email and password.' };
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  return { ok: true };
}

/**
 * Mirrors Better Auth: emailOtp.sendVerificationOtp({ type: "email-verification" })
 */
export async function sendEmailVerificationOtp(email: string): Promise<AuthResult> {
  await delay(450);
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) {
    return { ok: false, error: 'Enter a valid email.' };
  }
  storeOtp(normalized, 'email-verification');
  return { ok: true };
}

/**
 * Mirrors Better Auth: emailOtp.verifyEmail({ email, otp })
 */
export async function verifyEmailOtp(email: string, otp: string): Promise<AuthResult> {
  await delay(550);
  const normalized = normalizeEmail(email);
  const expected = readOtp(normalized, 'email-verification');
  if (otp.trim().length !== 6) {
    return { ok: false, error: 'Enter the 6-digit code.' };
  }
  if (otp.trim() !== expected) {
    return { ok: false, error: 'That code is incorrect.' };
  }
  pendingOtps.delete(otpKey(normalized, 'email-verification'));
  await setAuthSession();
  return { ok: true };
}

/**
 * Mirrors Better Auth: emailOtp.requestPasswordReset({ email })
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  await delay(450);
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) {
    return { ok: false, error: 'Enter a valid email.' };
  }
  storeOtp(normalized, 'forget-password');
  return { ok: true };
}

/**
 * Mirrors Better Auth: emailOtp.checkVerificationOtp({ type: "forget-password" })
 */
export async function checkForgetPasswordOtp(email: string, otp: string): Promise<AuthResult> {
  await delay(400);
  const normalized = normalizeEmail(email);
  const expected = readOtp(normalized, 'forget-password');
  if (otp.trim().length !== 6) {
    return { ok: false, error: 'Enter the 6-digit code.' };
  }
  if (otp.trim() !== expected) {
    return { ok: false, error: 'That code is incorrect.' };
  }
  return { ok: true };
}

/**
 * Mirrors Better Auth: emailOtp.resetPassword({ email, otp, password })
 * Does not create a session — user signs in with the new password.
 */
export async function resetPasswordWithOtp(input: {
  email: string;
  otp: string;
  password: string;
}): Promise<AuthResult> {
  await delay(650);
  const normalized = normalizeEmail(input.email);
  const expected = readOtp(normalized, 'forget-password');
  if (input.otp.trim() !== expected) {
    return { ok: false, error: 'That code is incorrect or expired.' };
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  pendingOtps.delete(otpKey(normalized, 'forget-password'));
  return { ok: true };
}

export async function signInGoogle(): Promise<AuthResult> {
  await delay(700);
  await setAuthSession();
  return { ok: true };
}
