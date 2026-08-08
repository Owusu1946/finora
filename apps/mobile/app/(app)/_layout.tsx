import { useAui } from '@assistant-ui/react-native';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useDrawerStatus } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { Pressable, StyleSheet, View } from 'react-native';

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
      style={({ pressed }) => [
        styles.headerAction,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon
        name='compose'
        size={22}
        color={colors.foreground}
      />
    </Pressable>
  );
}

function ScanHeaderButton() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityLabel='Scan QR to pay'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        router.push('/scan');
      }}
      style={({ pressed }) => [
        styles.headerAction,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon
        name='qr'
        size={22}
        color={colors.foreground}
      />
    </Pressable>
  );
}

function ChatDrawerButton() {
  const { colors } = useTheme();
  const drawerStatus = useDrawerStatus();

  if (drawerStatus === 'open') return null;

  return (
    <View
      style={[
        styles.headerAction,
        styles.drawerAction,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      <DrawerToggleButton tintColor={colors.foreground} />
    </View>
  );
}

function ChatHeaderRight() {
  return (
    <>
      <ScanHeaderButton />
      <NewChatButton />
    </>
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
        headerRight: () => <ChatHeaderRight />,
        headerShadowVisible: false,
        headerTintColor: colors.foreground,
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'center',
        drawerType: 'slide',
        overlayColor: 'rgba(0, 0, 0, 0.12)',
        swipeEnabled: true,
        drawerStyle: {
          width: 300,
          backgroundColor: colors.background,
          borderRightColor: colors.border,
          borderRightWidth: StyleSheet.hairlineWidth,
          boxShadow: '6px 0px 20px rgba(0, 0, 0, 0.18)',
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Drawer.Screen
        name='index'
        options={{
          title: '',
          headerTitle: () => null,
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerLeft: () => <ChatDrawerButton />,
          headerRightContainerStyle: { gap: 8, marginRight: 12 },
        }}
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
        options={{
          title: 'Settings',
          // Nested settings Stack owns its own headers (hub + drill-downs).
          headerShown: false,
        }}
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
      <Drawer.Screen
        name='scan'
        options={{
          ...screenOptions('Scan'),
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackHeaderButton />,
          headerRight: () => null,
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  drawerAction: {
    overflow: 'hidden',
  },
});
