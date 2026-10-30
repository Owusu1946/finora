import { useAui } from '@assistant-ui/react-native';
import { useNavigation, usePathname, useRouter } from 'expo-router';
import { Drawer, useDrawerStatus } from 'expo-router/drawer';
import { DrawerActions, useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderGlassButton, HeaderGlassSurface } from '@/components/navigation/header-glass-button';
import { AccountBadge, HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { ThreadListDrawer } from '@/components/thread-list/ThreadListDrawer';
import { Icon } from '@/components/ui/icon';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';
import { usePressGuard } from '@/lib/use-press-guard';

/** Progressive blur for the main drawer headers; content scrolls under. */
function HeaderBlurBackground() {
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

function NewChatButton() {
  const aui = useAui();
  const router = useRouter();
  const navigateOnce = usePressGuard();

  return (
    <HeaderGlassButton
      icon='compose'
      label='New chat'
      onPress={() => {
        haptics.selection();
        aui.threads.switchToNewThread();
        navigateOnce(() => router.push('/'));
      }}
    />
  );
}

function ScanHeaderButton() {
  const router = useRouter();
  const navigateOnce = usePressGuard();

  return (
    <HeaderGlassButton
      icon='qr'
      label='Scan QR to pay'
      onPress={() => {
        haptics.selection();
        navigateOnce(() => router.push('/scan'));
      }}
    />
  );
}

function DrawerTrigger() {
  const navigation = useNavigation();
  const drawerStatus = useDrawerStatus();
  const navigateOnce = usePressGuard();

  if (drawerStatus === 'open') return null;

  return (
    <HeaderGlassSurface>
      <HeaderGlassButton
        icon='menu'
        label='Open menu'
        onPress={() => {
          haptics.selection();
          navigateOnce(() => navigation.dispatch(DrawerActions.openDrawer()));
        }}
      />
    </HeaderGlassSurface>
  );
}

function ChatHeaderRight() {
  return (
    <HeaderGlassSurface>
      <NewChatButton />
      <ScanHeaderButton />
    </HeaderGlassSurface>
  );
}

function BackHeaderButton({ fallback = 'approvals' }: { fallback?: string }) {
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();
  const navigateOnce = usePressGuard();

  return (
    <Pressable
      accessibilityLabel='Go back'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        if (router.canGoBack()) {
          navigateOnce(() => router.back());
          return;
        }
        navigateOnce(() => navigation.dispatch(DrawerActions.jumpTo(fallback)));
      }}
      className='size-10 items-center justify-center rounded-full active:opacity-75'
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      <Icon
        name='chevron-left'
        size={22}
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

/**
 * Dismisses the keyboard on route changes. Lives in its own component so a
 * navigation re-renders only this, not the whole drawer navigator and headers.
 */
function KeyboardDismissOnRouteChange() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) Keyboard.dismiss();
    previousPathname.current = pathname;
  }, [pathname]);

  return null;
}

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useSettings();
  const insets = useSafeAreaInsets();

  return (
    <>
      <KeyboardDismissOnRouteChange />
      <Drawer
        drawerContent={(props) => <ThreadListDrawer {...props} />}
        screenOptions={{
          headerLeft: () => <DrawerTrigger />,
          headerRight: () => <ChatHeaderRight />,
          headerBackground: () => <HeaderBlurBackground />,
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
    </>
  );
}
