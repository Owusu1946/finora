import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { signInGoogle } from '@/lib/auth-mock';
import { haptics } from '@/lib/haptics';
import { usePostAuthNavigate } from '@/lib/use-post-auth-navigate';

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const postAuthNavigate = usePostAuthNavigate();
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

  return (
    <AuthShell
      footer={
        <View style={styles.footer}>
          <AuthButton
            label='Create account'
            onPress={() => router.push('/auth/signup')}
          />
          <GoogleButton
            onPress={handleGoogle}
            loading={googleLoading}
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
  footer: {
    gap: 12,
    width: '100%',
    alignItems: 'stretch',
  },
});
