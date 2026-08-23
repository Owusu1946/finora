import { useClerk, useSignIn } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppleButton } from '@/components/auth/AppleButton';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthDivider } from '@/components/auth/AuthDivider';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppText as Text } from '@/components/ui/text';
import { setPendingAuthProfile } from '@/lib/auth-profile';
import { clerkErrorMessage, clerkFieldErrorMessage } from '@/lib/clerk-auth';
import { haptics } from '@/lib/haptics';
import { useAppleAuth } from '@/lib/use-apple-auth';
import { useGoogleAuth } from '@/lib/use-google-auth';
import { usePostAuthNavigate } from '@/lib/use-post-auth-navigate';

export default function LoginScreen() {
  const router = useRouter();
  const postAuthNavigate = usePostAuthNavigate();
  const clerk = useClerk();
  const { signIn, errors, fetchStatus } = useSignIn();
  const google = useGoogleAuth();
  const apple = useAppleAuth();
  const params = useLocalSearchParams<{ email?: string; reset?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email : '';
  const showResetSuccess = params.reset === '1';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const loading = fetchStatus === 'fetching';

  const handleSignIn = async () => {
    if (loading) return;
    setError(null);
    if (!email.trim() || !password) {
      haptics.impact();
      setError('Enter email and password.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const result = await signIn.password({ emailAddress: normalizedEmail, password });
    if (result.error) {
      haptics.impact();
      setError(clerkErrorMessage(result.error, 'Could not sign in.'));
      return;
    }
    if (signIn.status !== 'complete') {
      haptics.impact();
      setError('This account requires an authentication step Finora does not support yet.');
      return;
    }

    const finalized = await signIn.finalize();
    if (finalized.error) {
      haptics.impact();
      setError(clerkErrorMessage(finalized.error, 'Could not finish signing in.'));
      return;
    }

    setPendingAuthProfile({
      name: normalizedEmail.split('@')[0] || 'Finora user',
      email: normalizedEmail,
    });
    haptics.success();
    const authenticatedUserId =
      clerk?.client?.sessions?.find((session) => session.id === signIn.createdSessionId)?.user
        ?.id ?? clerk?.session?.user?.id;
    await postAuthNavigate(authenticatedUserId);
  };

  return (
    <AuthShell
      showBack
      footer={
        <View className='w-full items-stretch gap-4'>
          <AuthButton
            label='Sign in'
            onPress={handleSignIn}
            loading={loading}
            disabled={loading || google.loading || apple.loading}
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
            <Text className='py-1 text-center font-sans-medium text-[15px] text-muted-foreground'>
              Forgot password?
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/auth/signup');
            }}
          >
            <Text className='py-1 text-center font-sans-medium text-[15px] text-muted-foreground'>
              Don’t have an account?{' '}
              <Text className='font-sans-semibold text-foreground'>Create one</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View className='mb-1 gap-2'>
        <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          Welcome back
        </Text>
        <Text className='font-sans-medium text-[17px] leading-[22px] tracking-[-0.2px] text-muted-foreground'>
          Sign in to continue to Finora.
        </Text>
        {showResetSuccess ? (
          <Text className='mt-1 font-sans-medium text-[15px] leading-5 tracking-[-0.1px] text-foreground'>
            Password updated. Sign in with your new password.
          </Text>
        ) : null}
      </View>

      <GoogleButton
        onPress={google.startGoogleAuth}
        loading={google.loading}
        disabled={loading || apple.loading}
      />
      <AppleButton
        onPress={apple.startAppleAuth}
        loading={apple.loading}
        disabled={loading || google.loading}
      />
      <AuthDivider />

      <View className='gap-4'>
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
          error={
            error ??
            google.error ??
            apple.error ??
            clerkFieldErrorMessage(errors.fields.identifier) ??
            clerkFieldErrorMessage(errors.fields.password)
          }
        />
      </View>
    </AuthShell>
  );
}
