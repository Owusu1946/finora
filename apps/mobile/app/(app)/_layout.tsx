import { useAui } from '@assistant-ui/react-native';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Pressable } from 'react-native';

import { HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { ThreadListDrawer } from '@/components/thread-list/ThreadListDrawer';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

function NewChatButton() {
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
      style={{ marginRight: 16 }}
    >
      <Icon
        name='compose'
        size={22}
        color={colors.foreground}
      />
    </Pressable>
  );
}

function BackHeaderButton() {
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityLabel='Go back'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        if (router.canGoBack()) {
          router.back();
          return;
        }
        navigation.dispatch(DrawerActions.jumpTo('approvals'));
      }}
      style={{ marginLeft: 4, padding: 4 }}
    >
      <Icon
        name='chevron-left'
        size={24}
        color={colors.foreground}
      />
    </Pressable>
  );
}

function screenOptions(title: string) {
  return {
    title,
    headerTitle: () => <HeaderTitleWithAccount title={title} />,
  };
}

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <ThreadListDrawer {...props} />}
      screenOptions={{
        headerRight: () => <NewChatButton />,
        headerShadowVisible: false,
        headerTintColor: colors.foreground,
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
        drawerType: 'front',
        swipeEnabled: true,
        drawerStyle: {
          width: 300,
          backgroundColor: colors.background,
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Drawer.Screen
        name='index'
        options={screenOptions('Chat')}
      />
      <Drawer.Screen
        name='wallets'
        options={screenOptions('Wallets')}
      />
      <Drawer.Screen
        name='activity'
        options={screenOptions('Activity')}
      />
      <Drawer.Screen
        name='approvals'
        options={screenOptions('Approvals')}
      />
      <Drawer.Screen
        name='invoices'
        options={screenOptions('Invoices')}
      />
      <Drawer.Screen
        name='recurring'
        options={screenOptions('Recurring')}
      />
      <Drawer.Screen
        name='contacts'
        options={screenOptions('Contacts')}
      />
      <Drawer.Screen
        name='integrations'
        options={screenOptions('Integrations')}
      />
      <Drawer.Screen
        name='settings'
        options={screenOptions('Settings')}
      />
      <Drawer.Screen
        name='transaction/[id]'
        options={{
          ...screenOptions('Transaction'),
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackHeaderButton />,
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name='approval/[id]'
        options={{
          ...screenOptions('Approve payment'),
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackHeaderButton />,
          headerRight: () => null,
        }}
      />
    </Drawer>
  );
}
