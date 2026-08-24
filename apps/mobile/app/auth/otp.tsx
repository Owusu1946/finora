import { useSignIn, useSignUp } from '@clerk/expo';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AUTH_OTP_LENGTH, AuthOtpInput } from '@/components/auth/AuthOtpInput';
import { AuthShell } from '@/components/auth/AuthShell';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { clerkErrorMessage, clerkFieldErrorMessage } from '@/lib/clerk-auth';
import { haptics } from '@/lib/haptics';
import { usePostAuthNavigate } from '@/lib/use-post-auth-navigate';

const RESEND_SECONDS = 30;

export default function AuthOtpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const postAuthNavigate = usePostAuthNavigate();
  const { signIn, errors: signInErrors, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpFetchStatus } = useSignUp();
  const params = useLocalSearchParams<{ email?: string; purpose?: string }>();
  const email = typeof params.email === 'string' ? params.email.trim() : '';
  const isReset = params.purpose === 'reset';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const loading = signInFetchStatus === 'fetching' || signUpFetchStatus === 'fetching';

  useEffect(() => {
    if (!email) {
      router.replace((isReset ? '/auth/forgot-password' : '/auth/signup') as Href);
    }
  }, [email, isReset, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const canVerify = useMemo(() => code.length === AUTH_OTP_LENGTH, [code]);

  const handleVerify = useCallback(async () => {
    if (loading || !canVerify || !email) return;
    setError(null);
    if (isReset) {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (result.error) {
        haptics.impact();
        setError(clerkErrorMessage(result.error, 'That reset code is invalid or expired.'));
        return;
      }
      if (signIn.status !== 'needs_new_password') {
        haptics.impact();
        setError('Password recovery could not continue. Request a new code.');
        return;
      }
      haptics.success();
      router.push({
        pathname: '/auth/reset-password',
        params: { email },
      });
      return;
    }

    const result = await signUp.verifications.verifyEmailCode({ code });
    if (result.error) {
      haptics.impact();
      setError(clerkErrorMessage(result.error, 'That verification code is invalid or expired.'));
      return;
    }
    if (signUp.status !== 'complete') {
      haptics.impact();
      setError('Your account still has incomplete sign-up requirements.');
      return;
    }
    const finalized = await signUp.finalize();
    if (finalized.error) {
      haptics.impact();
      setError(clerkErrorMessage(finalized.error, 'Could not finish creating your account.'));
      return;
    }
    haptics.success();
    await postAuthNavigate(signUp.createdUserId);
  }, [canVerify, code, email, isReset, loading, postAuthNavigate, router, signIn, signUp]);

  const handleResend = useCallback(async () => {
    if (resending || cooldown > 0 || !email) return;
    setError(null);
    setResending(true);
    const result = isReset
      ? await signIn.resetPasswordEmailCode.sendCode()
      : await signUp.verifications.sendEmailCode();
    setResending(false);
    if (!result.error) {
      haptics.success();
      setCooldown(RESEND_SECONDS);
      setCode('');
    } else {
      haptics.impact();
      setError(clerkErrorMessage(result.error, 'Could not resend the code.'));
    }
  }, [cooldown, email, isReset, resending, signIn, signUp]);

  if (!email) return null;

  return (
    <AuthShell
      showBack
      footer={
        <View style={styles.footer}>
          <AuthButton
            label={isReset ? 'Continue' : 'Verify email'}
            onPress={handleVerify}
            loading={loading}
            disabled={!canVerify || loading}
          />
          <Pressable
            disabled={cooldown > 0 || resending}
            onPress={handleResend}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.resend, { color: colors.mutedForeground }]}>
              {cooldown > 0
                ? `Resend code in ${cooldown}s`
                : resending
                  ? 'Sending…'
                  : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isReset ? 'Enter reset code' : 'Check your email'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Enter the {AUTH_OTP_LENGTH}-digit code we sent to{' '}
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>{email}</Text>
        </Text>
      </View>

      <AuthOtpInput
        value={code}
        onChange={(next) => {
          setError(null);
          setCode(next);
        }}
        error={
          error ??
          clerkFieldErrorMessage(isReset ? signInErrors.fields.code : signUpErrors.fields.code)
        }
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  footer: {
    gap: 16,
    width: '100%',
    alignItems: 'stretch',
  },
  resend: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
  },
});
