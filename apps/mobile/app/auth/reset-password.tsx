import { useSignIn } from '@clerk/expo';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { AppText as Text } from '@/components/ui/text';
import { clerkErrorMessage, clerkFieldErrorMessage } from '@/lib/clerk-auth';
import { haptics } from '@/lib/haptics';

export default function ResetPasswordScreen() {
  const router = useRouter();
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
        <View className='mb-2 gap-2.5'>
          <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
            Reset password
          </Text>
          <Text className='font-sans-medium text-[17px] leading-[23px] tracking-[-0.2px] text-muted-foreground'>
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
        <View className='w-full items-stretch gap-4'>
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
            <Text className='py-1 text-center font-sans-medium text-[15px] text-muted-foreground'>
              Back to <Text className='font-sans-semibold text-foreground'>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View className='mb-2 gap-2.5'>
        <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          Choose a new password
        </Text>
        <Text className='font-sans-medium text-[17px] leading-[23px] tracking-[-0.2px] text-muted-foreground'>
          Use at least 15 characters for{' '}
          <Text className='font-sans-semibold text-foreground'>{email}</Text>
        </Text>
      </View>

      <View className='gap-4'>
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
