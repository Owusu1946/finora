import { useAui } from '@assistant-ui/react-native';
import { useDrawerStatus } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation, usePathname, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useEffect, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountBadge, HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { ThreadListDrawer } from '@/components/thread-list/ThreadListDrawer';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';

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

function DrawerTrigger() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const drawerStatus = useDrawerStatus();

  if (drawerStatus === 'open') return null;

  return (
    <Pressable
      accessibilityLabel='Open menu'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        navigation.dispatch(DrawerActions.openDrawer());
      }}
      style={[
        styles.headerAction,
        styles.drawerAction,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      <Icon
        name='menu'
        size={26}
        color={colors.foreground}
      />
    </Pressable>
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

function BackHeaderButton({ fallback = 'approvals' }: { fallback?: string }) {
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
        navigation.dispatch(DrawerActions.jumpTo(fallback));
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

function bodyTitleScreenOptions(title: string) {
  return {
    title,
    headerTitle: () => <AccountBadge />,
  };
}

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useSettings();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) Keyboard.dismiss();
    previousPathname.current = pathname;
  }, [pathname]);

  return (
    <Drawer
      drawerContent={(props) => <ThreadListDrawer {...props} />}
      screenOptions={{
        headerLeft: () => <DrawerTrigger />,
        headerRight: () => <ChatHeaderRight />,
        headerLeftContainerStyle: { paddingLeft: 16, paddingBottom: 8 },
        headerRightContainerStyle: { gap: 10, paddingRight: 16, paddingBottom: 8 },
        headerTitleContainerStyle: { paddingBottom: 8 },
        headerShadowVisible: false,
        headerStatusBarHeight: insets.top + 8,
        headerTintColor: colors.foreground,
        headerStyle: { backgroundColor: 'transparent' },
        headerTitleAlign: 'center',
        drawerType: 'back',
        overlayColor: 'rgba(0, 0, 0, 0.26)',
        swipeEnabled: true,
        drawerStyle: {
          width: '78%',
          backgroundColor: colors.background,
          borderRightColor: colors.border,
          borderRightWidth: StyleSheet.hairlineWidth,
        },
        sceneStyle: {
          backgroundColor: colors.background,
          boxShadow: '-5px 0px 16px rgba(0, 0, 0, 0.14)',
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
          headerLeft: () => <DrawerTrigger />,
        }}
      />
      <Drawer.Screen
        name='wallets'
        options={{
          ...screenOptions(t('nav_wallets')),
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Drawer.Screen
        name='cards'
        options={bodyTitleScreenOptions(t('nav_cards'))}
      />
      <Drawer.Screen
        name='virtual-card'
        options={{
          ...screenOptions(t('nav_request_card')),
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackHeaderButton fallback='cards' />,
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name='activity'
        options={{
          ...bodyTitleScreenOptions(t('nav_activity')),
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Drawer.Screen
        name='card/[id]'
        options={{
          ...screenOptions(t('nav_card')),
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackHeaderButton fallback='cards' />,
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name='approvals'
        options={bodyTitleScreenOptions(t('nav_approvals'))}
      />
      <Drawer.Screen
        name='invoices'
        options={bodyTitleScreenOptions(t('nav_invoices'))}
      />
      <Drawer.Screen
        name='recurring'
        options={bodyTitleScreenOptions(t('nav_recurring'))}
      />
      <Drawer.Screen
        name='payroll'
        options={bodyTitleScreenOptions(t('nav_payroll'))}
      />
      <Drawer.Screen
        name='suppliers'
        options={bodyTitleScreenOptions(t('nav_suppliers'))}
      />
      <Drawer.Screen
        name='beneficiaries'
        options={bodyTitleScreenOptions(t('nav_beneficiaries'))}
      />
      <Drawer.Screen
        name='expenses'
        options={bodyTitleScreenOptions(t('nav_expenses'))}
      />
      <Drawer.Screen
        name='treasury'
        options={bodyTitleScreenOptions(t('nav_treasury'))}
      />
      <Drawer.Screen
        name='automations'
        options={bodyTitleScreenOptions(t('nav_automations'))}
      />
      <Drawer.Screen
        name='policies'
        options={bodyTitleScreenOptions(t('nav_policies'))}
      />
      <Drawer.Screen
        name='contacts'
        options={bodyTitleScreenOptions(t('nav_contacts'))}
      />
      <Drawer.Screen
        name='integrations'
        options={bodyTitleScreenOptions(t('nav_integrations'))}
      />
      <Drawer.Screen
        name='settings'
        options={{
          title: t('nav_settings'),
          // Nested settings Stack owns its own headers (hub + drill-downs).
          headerShown: false,
        }}
      />
      <Drawer.Screen
        name='transaction/[id]'
        options={{
          ...screenOptions(t('nav_transaction')),
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackHeaderButton />,
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name='approval/[id]'
        options={{
          ...screenOptions(t('nav_approve_payment')),
          drawerItemStyle: { display: 'none' },
          headerLeft: () => <BackHeaderButton />,
          headerRight: () => null,
        }}
      />
      <Drawer.Screen
        name='scan'
        options={{
          ...screenOptions(t('nav_scan')),
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
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  drawerAction: {
    overflow: 'hidden',
  },
});
