import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useTheme } from '@/hooks/use-theme';
import { signInEmail, signInGoogle } from '@/lib/auth-mock';
import { haptics } from '@/lib/haptics';
import { usePostAuthNavigate } from '@/lib/use-post-auth-navigate';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const postAuthNavigate = usePostAuthNavigate();
  const params = useLocalSearchParams<{ email?: string; reset?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email : '';
  const showResetSuccess = params.reset === '1';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleSignIn = async () => {
    if (loading) return;
    setError(null);
    if (!email.trim() || !password) {
      haptics.impact();
      setError('Enter email and password.');
      return;
    }
    setLoading(true);
    const result = await signInEmail(email, password);
    setLoading(false);
    if (result.ok) {
      haptics.success();
      postAuthNavigate();
    } else {
      haptics.impact();
      setError(result.error);
    }
  };

  return (
    <AuthShell
      showBack
      footer={
        <View style={styles.footer}>
          <AuthButton
            label='Sign in'
            onPress={handleSignIn}
            loading={loading}
            disabled={loading || googleLoading}
          />
          <Pressable
            onPress={() => {
              haptics.selection();
              if (email.trim()) {
                router.push({
                  pathname: '/auth/forgot-password',
                  params: { email: email.trim() },
                });
              } else {
                router.push('/auth/forgot-password');
              }
            }}
          >
            <Text style={[styles.link, { color: colors.mutedForeground }]}>Forgot password?</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/auth/signup');
            }}
          >
            <Text style={[styles.linkRow, { color: colors.mutedForeground }]}>
              Don’t have an account?{' '}
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>Create one</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sign in to continue to Finora.
        </Text>
        {showResetSuccess ? (
          <Text style={[styles.success, { color: colors.foreground }]}>
            Password updated. Sign in with your new password.
          </Text>
        ) : null}
      </View>

      <GoogleButton
        onPress={handleGoogle}
        loading={googleLoading}
        disabled={loading}
      />
      <AuthDivider />

      <View style={styles.form}>
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
          autoComplete='password'
          textContentType='password'
          placeholder='Your password'
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
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  success: {
    marginTop: 4,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  footer: {
    gap: 16,
    width: '100%',
    alignItems: 'stretch',
  },
  link: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
  },
  linkRow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
  },
});
