import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { useTheme } from '@/hooks/use-theme';
import { resetPasswordWithOtp } from '@/lib/auth-mock';
import { haptics } from '@/lib/haptics';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string; otp?: string }>();
  const email = typeof params.email === 'string' ? params.email.trim() : '';
  const otp = typeof params.otp === 'string' ? params.otp.trim() : '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return password.length >= 8 && confirm === password && Boolean(email) && Boolean(otp);
  }, [confirm, email, otp, password]);

  if (!email || !otp) {
    return (
      <AuthShell showBack>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Reset password</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Start again from forgot password to get a new code.
          </Text>
        </View>
        <AuthButton
          label='Forgot password'
          onPress={() => router.replace('/auth/forgot-password' as Href)}
        />
      </AuthShell>
    );
  }

  const handleReset = async () => {
    if (loading || !canSubmit) return;
    setError(null);
    if (password !== confirm) {
      haptics.impact();
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      haptics.impact();
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const result = await resetPasswordWithOtp({ email, otp, password });
    setLoading(false);
    if (!result.ok) {
      haptics.impact();
      setError(result.error);
      return;
    }

    haptics.success();
    router.replace({
      pathname: '/auth/login',
      params: { reset: '1', email },
    });
  };

  return (
    <AuthShell
      showBack
      footer={
        <View style={styles.footer}>
          <AuthButton
            label='Update password'
            onPress={handleReset}
            loading={loading}
            disabled={!canSubmit || loading}
          />
          <Pressable
            onPress={() => {
              haptics.selection();
              router.replace('/auth/login');
            }}
          >
            <Text style={[styles.linkRow, { color: colors.mutedForeground }]}>
              Back to <Text style={{ color: colors.foreground, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Choose a new password</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Use at least 8 characters for{' '}
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>{email}</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <AuthField
          label='New password'
          value={password}
          onChangeText={setPassword}
          password
          autoComplete='new-password'
          textContentType='newPassword'
          placeholder='At least 8 characters'
          autoFocus
        />
        <AuthField
          label='Confirm password'
          value={confirm}
          onChangeText={setConfirm}
          password
          autoComplete='new-password'
          textContentType='newPassword'
          placeholder='Repeat password'
          error={error ?? undefined}
        />
      </View>
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
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  form: {
    gap: 16,
  },
  footer: {
    gap: 16,
    width: '100%',
    alignItems: 'stretch',
  },
  linkRow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
  },
});
