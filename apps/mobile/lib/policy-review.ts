import type { PolicyResult } from '@finora/shared';

import { Alert } from 'react-native';

/**
 * Before the passcode: tells the user why their policies flagged a payment and
 * lets them back out, or explains why it's blocked. Resolves true to go ahead.
 */
export function reviewPolicy(policy: PolicyResult | null | undefined): Promise<boolean> {
  if (!policy || policy.outcome === 'allowed') return Promise.resolve(true);
  const reasons = policy.reasons.join('\n');
  if (policy.outcome === 'blocked') {
    Alert.alert(
      'Blocked by your policies',
      `${reasons}\n\nChange the amount or the policy to pay.`,
    );
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    Alert.alert('Check before you approve', reasons, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ]);
  });
}
