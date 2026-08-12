import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppleButton } from '@/components/auth/AppleButton';
import { AuthButton } from '@/components/auth/AuthButton';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { useAppleAuth } from '@/lib/use-apple-auth';
import { useGoogleAuth } from '@/lib/use-google-auth';

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const google = useGoogleAuth();
  const apple = useAppleAuth();

  return (
    <AuthShell
      footer={
        <View style={styles.footer}>
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
      <View style={styles.hero}>
        <Text style={[styles.brand, { color: colors.mutedForeground }]}>Finora</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Money, in conversation.</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Create an account or sign in to continue.
        </Text>
        {google.error || apple.error ? (
          <Text
            accessibilityRole='alert'
            style={[styles.error, { color: colors.destructive }]}
          >
            {google.error ?? apple.error}
          </Text>
        ) : null}
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  brand: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 300,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  footer: {
    gap: 12,
    width: '100%',
    alignItems: 'stretch',
  },
});
