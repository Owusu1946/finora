import { useAui } from '@assistant-ui/react-native';
import { DrawerActions } from '@react-navigation/native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';

function MenuHeaderButton() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityLabel='Open menu'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        navigation.dispatch(DrawerActions.openDrawer());
      }}
      style={styles.headerAction}
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

  return (
    <Pressable
      accessibilityLabel='New chat'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        aui.threads.switchToNewThread();
        router.push('/');
      }}
      style={styles.headerAction}
    >
      <Icon
        name='compose'
        size={22}
        color={colors.foreground}
      />
    </Pressable>
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
        headerTintColor: colors.foreground,
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: t('nav_settings'),
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

const styles = StyleSheet.create({
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
});
