import type { BusinessApp } from '@finora/shared';

import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';

export function BusinessAppLogo({
  app,
  size = 36,
}: {
  app: Pick<BusinessApp, 'logo'>;
  size?: number;
}) {
  return (
    <View
      className='items-center justify-center overflow-hidden rounded-xl border border-border bg-white'
      style={{ width: size, height: size, borderCurve: 'continuous' }}
    >
      {app.logo ? (
        <Image
          source={app.logo}
          style={{ width: size * 0.66, height: size * 0.66 }}
          contentFit='contain'
          transition={150}
        />
      ) : null}
    </View>
  );
}

function StatusAction({
  app,
  busy,
  onConnect,
}: {
  app: BusinessApp;
  busy: boolean;
  onConnect: () => void;
}) {
  const { colors } = useTheme();
  if (busy) return <LoadingIcon color={colors.mutedForeground} />;
  if (app.status === 'connected') {
    return (
      <View className='flex-row items-center gap-1.5'>
        <View className='size-2 rounded bg-emerald-500' />
        <Text className='font-sans-medium text-[13px] text-muted-foreground'>Connected</Text>
      </View>
    );
  }
  if (!app.connectable) {
    return <Text className='font-sans-medium text-[13px] text-muted-foreground'>Coming soon</Text>;
  }
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={`Connect ${app.name}`}
      onPress={onConnect}
      hitSlop={6}
      className='min-h-[34px] items-center justify-center rounded-full bg-foreground px-3.5 active:opacity-80'
    >
      <Text className='font-sans-semibold text-[13px] text-background'>
        {app.status === 'error' ? 'Reconnect' : 'Connect'}
      </Text>
    </Pressable>
  );
}

/**
 * One business app: logo, name, what it's for, and its connection state.
 * Tapping a connected app offers to disconnect it.
 */
export function BusinessAppRow({
  app,
  busy,
  onConnect,
  onManage,
}: {
  app: BusinessApp;
  busy: boolean;
  onConnect: () => void;
  onManage: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={app.status === 'connected' ? 'button' : undefined}
      disabled={app.status !== 'connected' || busy}
      onPress={onManage}
      className='min-h-[64px] flex-row items-center gap-3 py-2.5 active:opacity-75'
    >
      <BusinessAppLogo app={app} />
      <View className='flex-1 gap-0.5'>
        <Text
          className='font-sans-semibold text-[15px] text-foreground'
          numberOfLines={1}
        >
          {app.name}
        </Text>
        {app.description ? (
          <Text
            className='font-sans text-[13px] leading-[17px] text-muted-foreground'
            numberOfLines={2}
          >
            {app.description}
          </Text>
        ) : null}
      </View>
      <StatusAction
        app={app}
        busy={busy}
        onConnect={onConnect}
      />
    </Pressable>
  );
}
