import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
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
  const { isSignedIn } = useAuth();
  const { completed: onboardingCompleted } = useOnboardingGate();
  const started = useRef(false);

  useEffect(() => {
    if (!preparationId || started.current) return;

    if (!onboardingCompleted) {
      setPendingPaymentLink(preparationId);
      router.replace('/onboarding');
      return;
    }
    if (!isSignedIn) {
      setPendingPaymentLink(preparationId);
      router.replace('/auth');
      return;
    }

    started.current = true;
    startPaymentFromLink(preparationId, aui, router);
  }, [preparationId, isSignedIn, onboardingCompleted, aui, router]);

  return (
    <View className='flex-1 items-center justify-center gap-3 bg-background'>
      <LoadingIcon color={colors.mutedForeground} />
      <Text className='font-sans text-base text-muted-foreground'>Opening payment…</Text>
    </View>
  );
}
