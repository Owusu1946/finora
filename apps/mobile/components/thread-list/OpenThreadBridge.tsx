import { useAui } from '@assistant-ui/react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { subscribeOpenThread } from '@/lib/open-thread';

/** Opens chats requested from outside the runtime, e.g. by an automation notification. */
export function OpenThreadBridge() {
  const aui = useAui();
  const router = useRouter();

  useEffect(
    () =>
      subscribeOpenThread((chatId) => {
        router.navigate('/');
        try {
          aui.threads.switchToThread(chatId);
        } catch (error) {
          console.warn('[open-thread] could not open chat', error);
        }
      }),
    [aui, router],
  );

  return null;
}
