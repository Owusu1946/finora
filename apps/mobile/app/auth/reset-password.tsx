import { useSignIn } from '@clerk/expo';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { clerkErrorMessage, clerkFieldErrorMessage } from '@/lib/clerk-auth';
import { haptics } from '@/lib/haptics';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, errors, fetchStatus } = useSignIn();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email.trim() : '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const loading = fetchStatus === 'fetching';

  const canSubmit = useMemo(() => {
    return password.length >= 15 && confirm === password && Boolean(email);
  }, [confirm, email, password]);

  if (!email || signIn.status !== 'needs_new_password') {
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
    if (password.length < 15) {
      haptics.impact();
      setError('Password must be at least 15 characters.');
      return;
    }

    const result = await signIn.resetPasswordEmailCode.submitPassword({
      password,
      signOutOfOtherSessions: true,
    });
    if (result.error) {
      haptics.impact();
      setError(clerkErrorMessage(result.error, 'Could not update your password.'));
      return;
    }
    await signIn.reset();

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
          Use at least 15 characters for{' '}
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
          placeholder='At least 15 characters'
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
          error={error ?? clerkFieldErrorMessage(errors.fields.password)}
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
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
  },
});
