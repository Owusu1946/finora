import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthGate } from '@/lib/auth-gate';
import { haptics } from '@/lib/haptics';
import { useOnboardingGate } from '@/lib/onboarding-gate';
import { resetFinoraSession } from '@/lib/reset-session';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { markSignedOut } = useAuthGate();
  const { markIncomplete } = useOnboardingGate();

  const handleReset = async () => {
    haptics.selection();
    await resetFinoraSession();
    markSignedOut();
    markIncomplete();
    haptics.success();
    router.replace('/onboarding' as Href);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        Approvals, security, and account preferences will be configured here.
      </Text>

      {__DEV__ ? (
        <Pressable
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetBtn,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.muted : colors.composer,
            },
          ]}
        >
          <Text style={[styles.resetLabel, { color: colors.foreground }]}>
            Reset auth, onboarding & passcode
          </Text>
          <Text style={[styles.resetHint, { color: colors.mutedForeground }]}>
            Clears session keys and returns to onboarding
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
    maxWidth: 340,
    marginBottom: 16,
  },
  resetBtn: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  resetLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  resetHint: {
    fontSize: 13,
    fontWeight: '500',
  },
});
