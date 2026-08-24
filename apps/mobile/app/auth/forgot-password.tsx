import { useSignIn } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthShell } from '@/components/auth/AuthShell';
import { AppText as Text } from '@/components/ui/text';
import { clerkErrorMessage, clerkFieldErrorMessage } from '@/lib/clerk-auth';
import { haptics } from '@/lib/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
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
        <View className='w-full items-stretch gap-4'>
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
            <Text className='py-1 text-center font-sans-medium text-[15px] text-muted-foreground'>
              Remember your password?{' '}
              <Text className='font-sans-semibold text-foreground'>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View className='mb-2 gap-2.5'>
        <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          Forgot password?
        </Text>
        <Text className='font-sans-medium text-[17px] leading-[23px] tracking-[-0.2px] text-muted-foreground'>
          Enter your email and we’ll send a 6-digit code to reset it.
        </Text>
      </View>

      <View className='gap-4'>
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
