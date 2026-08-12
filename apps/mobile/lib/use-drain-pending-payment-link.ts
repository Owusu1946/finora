import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useOnboardingGate } from '@/lib/onboarding-gate';
import { startPaymentFromLink } from '@/lib/open-payment-link';
import { takePendingPaymentLink } from '@/lib/pending-payment-link';

/** After login / onboarding, resume a payment link that opened the app cold. */
export function useDrainPendingPaymentLink() {
  const aui = useAui();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { completed } = useOnboardingGate();
  const drained = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !completed || drained.current) return;
    const id = takePendingPaymentLink();
    if (!id) return;
    drained.current = true;
    startPaymentFromLink(id, aui, router);
  }, [isSignedIn, completed, aui, router]);
}
