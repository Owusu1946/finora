import { useAui } from '@assistant-ui/react-native';
import { DrawerActions } from '@react-navigation/native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

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
      style={[styles.headerAction, styles.headerLeftAction]}
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
      style={[styles.headerAction, styles.headerRightAction]}
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

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.foreground,
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: 'Settings',
      }}
    >
      <Stack.Screen
        name='index'
        options={{
          title: 'Settings',
          headerTitle: () => <HeaderTitleWithAccount title='Settings' />,
          headerLeft: () => <MenuHeaderButton />,
          headerRight: () => <NewChatHeaderButton />,
        }}
      />
      <Stack.Screen
        name='account'
        options={{ title: 'Account' }}
      />
      <Stack.Screen
        name='security'
        options={{ title: 'Security' }}
      />
      <Stack.Screen
        name='notifications'
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name='appearance'
        options={{ title: 'Appearance' }}
      />
      <Stack.Screen
        name='memory'
        options={{ title: 'Memory' }}
      />
      <Stack.Screen
        name='about'
        options={{ title: 'About Finora' }}
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
  headerLeftAction: {
    marginLeft: 12,
  },
  headerRightAction: {
    marginRight: 12,
  },
});
