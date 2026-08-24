import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppleButton } from '@/components/auth/AppleButton';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppText as Text } from '@/components/ui/text';
import { useAppleAuth } from '@/lib/use-apple-auth';
import { useGoogleAuth } from '@/lib/use-google-auth';

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const google = useGoogleAuth();
  const apple = useAppleAuth();

  return (
    <AuthShell
      footer={
        <View className='w-full items-stretch gap-3'>
          <AuthButton
            label='Create account'
            onPress={() => router.push('/auth/signup')}
          />
          <GoogleButton
            onPress={google.startGoogleAuth}
            loading={google.loading}
            disabled={apple.loading}
          />
          <AppleButton
            onPress={apple.startAppleAuth}
            loading={apple.loading}
            disabled={google.loading}
          />
          <AuthButton
            label='Sign in'
            variant='ghost'
            onPress={() => router.push('/auth/login')}
          />
        </View>
      }
    >
      <View className='items-center gap-3 px-2'>
        <Text className='font-sans-semibold text-sm uppercase tracking-[0.6px] text-muted-foreground'>
          Finora
        </Text>
        <Text className='text-center font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
          Money, in conversation.
        </Text>
        <Text className='max-w-[300px] text-center font-sans-medium text-[17px] leading-[23px] tracking-[-0.2px] text-muted-foreground'>
          Create an account or sign in to continue.
        </Text>
        {google.error || apple.error ? (
          <Text
            accessibilityRole='alert'
            className='max-w-[300px] text-center font-sans-medium text-sm leading-5 text-destructive'
          >
            {google.error ?? apple.error}
          </Text>
        ) : null}
      </View>
    </AuthShell>
  );
}
