import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { BusinessAppLogo } from '@/components/integrations/BusinessAppRow';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { connectBusinessApp, listBusinessApps } from '@/lib/business-apps-api';
import { haptics } from '@/lib/haptics';

type SuggestAppConnectionArgs = { app?: string; reason?: string };

type SuggestAppConnectionResult = {
  app: string;
  name: string;
  logo: string;
  reason: string;
  connected: boolean;
};

/** A Connect card for an app the request needs; continues the chat once connected. */
export function AppConnectCard({
  app,
  name,
  logo,
  reason,
  initiallyConnected,
}: {
  app: string;
  name: string;
  logo: string | null;
  reason: string;
  initiallyConnected: boolean;
}) {
  const { getToken } = useAuth();
  const { colors } = useTheme();
  const aui = useAui();
  const [connected, setConnected] = useState(initiallyConnected);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    haptics.selection();
    setBusy(true);
    try {
      await connectBusinessApp(getToken, app);
      const status = (await listBusinessApps(getToken)).find((item) => item.slug === app)?.status;
      if (status === 'connected') {
        haptics.success();
        setConnected(true);
      }
    } catch (error) {
      haptics.error();
      Alert.alert(`Couldn't connect ${name}`, error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      className='my-2 gap-3 border border-border bg-composer p-4'
      style={{ borderRadius: Radius.card, borderCurve: 'continuous' }}
    >
      <View className='flex-row items-center gap-3'>
        <BusinessAppLogo
          app={{ logo }}
          size={40}
        />
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-semibold text-[16px] text-foreground'>
            {connected ? `${name} is connected` : `Connect ${name}`}
          </Text>
          <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
            {reason}
          </Text>
        </View>
      </View>
      {connected ? (
        <Pressable
          accessibilityRole='button'
          onPress={() => {
            haptics.selection();
            aui.composer.setText(`I connected ${name}. Go ahead.`);
            aui.composer.send();
          }}
          className='min-h-[46px] items-center justify-center rounded-full bg-foreground px-3 active:opacity-85'
        >
          <Text className='font-sans-semibold text-[15px] text-background'>Continue</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole='button'
          disabled={busy}
          onPress={() => void connect()}
          className='min-h-[46px] flex-row items-center justify-center gap-2 rounded-full bg-foreground px-3 active:opacity-85 disabled:opacity-60'
        >
          {busy ? <LoadingIcon color={colors.background} /> : null}
          <Text className='font-sans-semibold text-[15px] text-background'>
            {busy ? 'Connecting' : `Connect ${name}`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export const SuggestAppConnectionToolUI = makeAssistantToolUI<
  SuggestAppConnectionArgs,
  SuggestAppConnectionResult
>({
  toolName: 'suggest_app_connection',
  display: 'standalone',
  render: ({ result }) => {
    if (!result) return null;
    return (
      <AppConnectCard
        app={result.app}
        name={result.name}
        logo={result.logo}
        reason={result.reason}
        initiallyConnected={result.connected}
      />
    );
  },
});
