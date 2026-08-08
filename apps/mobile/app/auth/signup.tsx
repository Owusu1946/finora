import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useTheme } from '@/hooks/use-theme';
import { sendEmailVerificationOtp, signInGoogle, signUpEmail } from '@/lib/auth-mock';
import { haptics } from '@/lib/haptics';
import { usePostAuthNavigate } from '@/lib/use-post-auth-navigate';

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const postAuthNavigate = usePostAuthNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length >= 8 && confirm === password;
  }, [confirm, email, password]);

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    const result = await signInGoogle();
    setGoogleLoading(false);
    if (result.ok) {
      haptics.success();
      postAuthNavigate();
    } else {
      haptics.impact();
    }
  };

  const handleSignup = async () => {
    if (loading) return;
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
    const signedUp = await signUpEmail({ name, email, password });
    if (!signedUp.ok) {
      setLoading(false);
      haptics.impact();
      setError(signedUp.error);
      return;
    }

    const otpSent = await sendEmailVerificationOtp(email);
    setLoading(false);
    if (!otpSent.ok) {
      haptics.impact();
      setError(otpSent.error);
      return;
    }

    haptics.success();
    router.push({
      pathname: '/auth/otp',
      params: { email: email.trim() },
    });
  };

  return (
    <AuthShell
      showBack
      footer={
        <View style={styles.footer}>
          <AuthButton
            label='Create account'
            onPress={handleSignup}
            loading={loading}
            disabled={!canSubmit || loading || googleLoading}
          />
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/auth/login');
            }}
          >
            <Text style={[styles.linkRow, { color: colors.mutedForeground }]}>
              Already have an account?{' '}
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Create your account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          A few details to get started.
        </Text>
      </View>

      <GoogleButton
        onPress={handleGoogle}
        loading={googleLoading}
        disabled={loading}
      />
      <AuthDivider />

      <View style={styles.form}>
        <AuthField
          label='Name'
          value={name}
          onChangeText={setName}
          autoComplete='name'
          textContentType='name'
          placeholder='Your name'
        />
        <AuthField
          label='Email'
          value={email}
          onChangeText={setEmail}
          keyboardType='email-address'
          autoComplete='email'
          textContentType='emailAddress'
          placeholder='you@example.com'
        />
        <AuthField
          label='Password'
          value={password}
          onChangeText={setPassword}
          password
          autoComplete='new-password'
          textContentType='newPassword'
          placeholder='At least 8 characters'
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
    gap: 8,
    marginBottom: 4,
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
    lineHeight: 22,
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
