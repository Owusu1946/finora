import { useSignIn } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { clerkErrorMessage, clerkFieldErrorMessage } from '@/lib/clerk-auth';
import { haptics } from '@/lib/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const { signIn, errors, fetchStatus } = useSignIn();
  const initialEmail = typeof params.email === 'string' ? params.email : '';

  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const loading = fetchStatus === 'fetching';

  const canSubmit = useMemo(() => email.trim().includes('@'), [email]);

  const handleContinue = async () => {
    if (loading || !canSubmit) return;
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const created = await signIn.create({ identifier: normalizedEmail });
    if (created.error) {
      haptics.impact();
      setError(clerkErrorMessage(created.error, 'Could not start password recovery.'));
      return;
    }
    const sent = await signIn.resetPasswordEmailCode.sendCode();
    if (sent.error) {
      haptics.impact();
      setError(clerkErrorMessage(sent.error, 'Could not send the reset code.'));
      return;
    }
    haptics.success();
    router.push({
      pathname: '/auth/otp',
      params: { email: normalizedEmail, purpose: 'reset' },
    });
  };

  return (
    <AuthShell
      showBack
      footer={
        <View style={styles.footer}>
          <AuthButton
            label='Send reset code'
            onPress={handleContinue}
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
              Remember your password?{' '}
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Forgot password?</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Enter your email and we’ll send a 6-digit code to reset it.
        </Text>
      </View>

      <View style={styles.form}>
        <AuthField
          label='Email'
          value={email}
          onChangeText={(text) => {
            setError(null);
            setEmail(text);
          }}
          keyboardType='email-address'
          autoComplete='email'
          textContentType='emailAddress'
          placeholder='you@example.com'
          autoFocus
          error={error ?? clerkFieldErrorMessage(errors.fields.identifier)}
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
