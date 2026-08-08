import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AUTH_OTP_LENGTH, AuthOtpInput } from '@/components/auth/AuthOtpInput';
import { AuthShell } from '@/components/auth/AuthShell';
import { useTheme } from '@/hooks/use-theme';
import {
  MOCK_EMAIL_OTP,
  checkForgetPasswordOtp,
  requestPasswordReset,
  sendEmailVerificationOtp,
  verifyEmailOtp,
} from '@/lib/auth-mock';
import { haptics } from '@/lib/haptics';
import { usePostAuthNavigate } from '@/lib/use-post-auth-navigate';

const RESEND_SECONDS = 30;

export default function AuthOtpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const postAuthNavigate = usePostAuthNavigate();
  const params = useLocalSearchParams<{ email?: string; purpose?: string }>();
  const email = typeof params.email === 'string' ? params.email.trim() : '';
  const isReset = params.purpose === 'reset';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

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
    setLoading(true);

    if (isReset) {
      const result = await checkForgetPasswordOtp(email, code);
      setLoading(false);
      if (!result.ok) {
        haptics.impact();
        setError(result.error);
        return;
      }
      haptics.success();
      router.push({
        pathname: '/auth/reset-password',
        params: { email, otp: code },
      });
      return;
    }

    const result = await verifyEmailOtp(email, code);
    setLoading(false);
    if (result.ok) {
      haptics.success();
      postAuthNavigate();
    } else {
      haptics.impact();
      setError(result.error);
    }
  }, [canVerify, code, email, isReset, loading, postAuthNavigate, router]);

  const handleResend = useCallback(async () => {
    if (resending || cooldown > 0 || !email) return;
    setError(null);
    setResending(true);
    const result = isReset
      ? await requestPasswordReset(email)
      : await sendEmailVerificationOtp(email);
    setResending(false);
    if (result.ok) {
      haptics.success();
      setCooldown(RESEND_SECONDS);
      setCode('');
    } else {
      haptics.impact();
      setError(result.error);
    }
  }, [cooldown, email, isReset, resending]);

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
        error={error ?? undefined}
      />

      {__DEV__ ? (
        <Text style={[styles.devHint, { color: colors.mutedForeground }]}>
          Dev mock code: {MOCK_EMAIL_OTP}
        </Text>
      ) : null}
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
  devHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
});
