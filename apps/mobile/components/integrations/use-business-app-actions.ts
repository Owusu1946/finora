import type { BusinessApp } from '@finora/shared';

import { useAuth } from '@clerk/expo';
import { useState } from 'react';
import { Alert } from 'react-native';

import { connectBusinessApp, disconnectBusinessApp } from '@/lib/business-apps-api';
import { haptics } from '@/lib/haptics';

/** Connect and disconnect business apps, then let the caller reload statuses. */
export function useBusinessAppActions(onChanged: () => Promise<void> | void) {
  const { getToken } = useAuth();
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const connect = async (app: Pick<BusinessApp, 'slug' | 'name'>) => {
    if (busySlug) return;
    haptics.selection();
    setBusySlug(app.slug);
    try {
      const finished = await connectBusinessApp(getToken, app.slug);
      if (finished) haptics.success();
    } catch (error) {
      haptics.error();
      Alert.alert(
        `Couldn't connect ${app.name}`,
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      // The sheet may close after a successful sign-in, so always re-check.
      await onChanged();
      setBusySlug(null);
    }
  };

  const manage = (app: Pick<BusinessApp, 'slug' | 'name'>) => {
    haptics.selection();
    Alert.alert(app.name, 'Finora can read data from this app and draft messages for you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          setBusySlug(app.slug);
          void disconnectBusinessApp(getToken, app.slug)
            .then(() => haptics.success())
            .catch((error) =>
              Alert.alert(
                `Couldn't disconnect ${app.name}`,
                error instanceof Error ? error.message : 'Try again.',
              ),
            )
            .finally(async () => {
              await onChanged();
              setBusySlug(null);
            });
        },
      },
    ]);
  };

  return { busySlug, connect, manage };
}
