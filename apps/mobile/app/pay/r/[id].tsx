import { useAui } from '@assistant-ui/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { useAuthGate } from '@/lib/auth-gate';
import { useOnboardingGate } from '@/lib/onboarding-gate';
import { startPaymentFromLink } from '@/lib/open-payment-link';
import { setPendingPaymentLink } from '@/lib/pending-payment-link';

/**
 * Deep link: finora://pay/r/{id} or https://pay.finora.app/r/{id}
 * Opens chat and starts prepare_payment for that request.
 */
export default function PayRequestDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const preparationId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const aui = useAui();
  const router = useRouter();
  const { colors } = useTheme();
  const { authenticated } = useAuthGate();
  const { completed: onboardingCompleted } = useOnboardingGate();
  const started = useRef(false);

  useEffect(() => {
    if (!preparationId || started.current) return;

    if (!onboardingCompleted) {
      setPendingPaymentLink(preparationId);
      router.replace('/onboarding');
      return;
    }
    if (!authenticated) {
      setPendingPaymentLink(preparationId);
      router.replace('/auth');
      return;
    }

    started.current = true;
    startPaymentFromLink(preparationId, aui, router);
  }, [preparationId, authenticated, onboardingCompleted, aui, router]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <LoadingIcon color={colors.mutedForeground} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Opening payment…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
});
