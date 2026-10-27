import { useAui } from '@assistant-ui/react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { DrawerActions } from '@react-navigation/native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { StyleSheet, Pressable } from 'react-native';

import { HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { Icon } from '@/components/ui/icon';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';
import { usePressGuard } from '@/lib/use-press-guard';

function BackHeaderButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const guard = usePressGuard();

  return (
    <Pressable
      accessibilityLabel='Go back'
      hitSlop={8}
      onPress={() => guard(() => navigation.goBack())}
      className='ml-3 size-10 items-center justify-center rounded-full active:opacity-70'
    >
      <Icon
        name='chevron-left'
        size={24}
        color={colors.foreground}
      />
    </Pressable>
  );
}

function MenuHeaderButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const navigateOnce = usePressGuard();

  return (
    <Pressable
      accessibilityLabel='Open menu'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        navigateOnce(() => navigation.dispatch(DrawerActions.openDrawer()));
      }}
      className='ml-3 size-10 items-center justify-center rounded-full'
    >
      <Icon
        name='menu'
        size={24}
        color={colors.foreground}
      />
    </Pressable>
  );
}

function NewChatHeaderButton() {
  const aui = useAui();
  const router = useRouter();
  const { colors } = useTheme();
  const navigateOnce = usePressGuard();

  return (
    <Pressable
      accessibilityLabel='New chat'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        aui.threads.switchToNewThread();
        navigateOnce(() => router.push('/'));
      }}
      className='mr-3 size-10 items-center justify-center rounded-full'
    >
      <Icon
        name='compose'
        size={22}
        color={colors.foreground}
      />
    </Pressable>
  );
}

/** Progressive blur behind the whole settings stack; content scrolls under. */
function SettingsHeaderBackground() {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  return (
    <ProgressiveBlur
      side='top'
      height={headerHeight || 96}
      tint={colors.background}
      tintStrength={0.36}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function SettingsLayout() {
  const { colors } = useTheme();
  const { t } = useSettings();

  return (
    <Stack
      screenOptions={{
        fullScreenGestureEnabled: true,
        gestureEnabled: true,
        headerShadowVisible: false,
        headerBackVisible: false,
        headerTintColor: colors.foreground,
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerBackground: () => <SettingsHeaderBackground />,
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: t('nav_settings'),
        headerLeft: () => <BackHeaderButton />,
      }}
    >
      <Stack.Screen
        name='index'
        options={{
          title: t('nav_settings'),
          headerTitle: () => <HeaderTitleWithAccount title={t('nav_settings')} />,
          headerLeft: () => <MenuHeaderButton />,
          headerRight: () => <NewChatHeaderButton />,
        }}
      />
      <Stack.Screen
        name='account'
        options={{ title: t('nav_account') }}
      />
      <Stack.Screen
        name='security'
        options={{ title: t('nav_security') }}
      />
      <Stack.Screen
        name='notifications'
        options={{ title: t('nav_notifications') }}
      />
      <Stack.Screen
        name='display'
        options={{ title: t('nav_display') }}
      />
      <Stack.Screen
        name='memory'
        options={{ title: t('nav_memory') }}
      />
      <Stack.Screen
        name='about'
        options={{ title: t('nav_about') }}
      />
    </Stack>
  );
}
