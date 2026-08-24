import { useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const google = useGoogleAuth();
  const apple = useAppleAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const loading = fetchStatus === 'fetching';

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length >= 15 && confirm === password;
  }, [confirm, email, password]);

  const handleSignup = async () => {
    if (loading) return;
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
    const normalizedEmail = email.trim().toLowerCase();
    const result = await signUp.password({
      emailAddress: normalizedEmail,
      password,
      unsafeMetadata: { displayName: name.trim() },
    });
    if (result.error) {
      haptics.impact();
      setError(clerkErrorMessage(result.error, 'Could not create your account.'));
      return;
    }

    setPendingAuthProfile({
      name: name.trim() || normalizedEmail.split('@')[0] || 'Finora user',
      email: normalizedEmail,
    });
    const verification = await signUp.verifications.sendEmailCode();
    if (verification.error) {
      haptics.impact();
      setError(clerkErrorMessage(verification.error, 'Could not send the verification code.'));
      return;
    }

    haptics.success();
    router.push({
      pathname: '/auth/otp',
      params: { email: normalizedEmail },
    });
  };

  return (
    <AuthShell
      showBack
      footer={
        <View className='w-full items-stretch gap-4'>
          <AuthButton
            label='Create account'
            onPress={handleSignup}
            loading={loading}
            disabled={!canSubmit || loading || google.loading || apple.loading}
          />
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/auth/login');
            }}
          >
            <Text className='py-1 text-center font-sans-medium text-[15px] text-muted-foreground'>
              Already have an account?{' '}
              <Text className='font-sans-semibold text-foreground'>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      }
    >
      <View className='mb-1 gap-2'>
        <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          Create your account
        </Text>
        <Text className='font-sans-medium text-[17px] leading-[22px] tracking-[-0.2px] text-muted-foreground'>
          A few details to get started.
        </Text>
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
          placeholder='At least 15 characters'
        />
        <AuthField
          label='Confirm password'
          value={confirm}
          onChangeText={setConfirm}
          password
          autoComplete='new-password'
          textContentType='newPassword'
          placeholder='Repeat password'
          error={
            error ??
            google.error ??
            apple.error ??
            clerkFieldErrorMessage(errors.fields.emailAddress) ??
            clerkFieldErrorMessage(errors.fields.password)
          }
        />
      </View>
      <View nativeID='clerk-captcha' />
    </AuthShell>
  );
}
