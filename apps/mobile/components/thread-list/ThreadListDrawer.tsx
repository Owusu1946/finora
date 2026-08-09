import { AppText as Text } from '@/components/ui/text';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';

import {
  ThreadListPrimitive,
  ThreadListItemByIndexProvider,
  useAui,
} from '@assistant-ui/react-native';
import { useDrawerStatus } from '@react-navigation/drawer';
import { type Href, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui/icon-mappings';

import { AccountBadge } from '@/components/shell/account-badge';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countPendingApprovals } from '@/lib/approvals-storage';
import { haptics } from '@/lib/haptics';

import { ThreadListItem } from './ThreadListItem';

type NavTab = 'money' | 'pay' | 'more';

type NavItem = { href: Href; label: string; icon: IconName };

const NAV_TABS: { id: NavTab; label: string; items: NavItem[] }[] = [
  {
    id: 'money',
    label: 'Money',
    items: [
      { href: '/wallets', label: 'Wallets', icon: 'wallet' },
      { href: '/cards', label: 'Cards', icon: 'card' },
      { href: '/activity', label: 'Activity', icon: 'activity' },
    ],
  },
  {
    id: 'pay',
    label: 'Pay',
    items: [
      { href: '/approvals', label: 'Approvals', icon: 'shield' },
      { href: '/invoices', label: 'Invoices', icon: 'file' },
      { href: '/recurring', label: 'Recurring', icon: 'reload' },
    ],
  },
  {
    id: 'more',
    label: 'More',
    items: [
      { href: '/contacts', label: 'Contacts', icon: 'contacts' },
      { href: '/integrations', label: 'Integrations', icon: 'integrations' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

function tabForPathname(pathname: string): NavTab {
  for (const tab of NAV_TABS) {
    if (tab.items.some((item) => pathname.startsWith(String(item.href)))) {
      return tab.id;
    }
  }
  return 'money';
}

export function ThreadListDrawer({ navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const aui = useAui();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const drawerStatus = useDrawerStatus();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [activeTab, setActiveTab] = useState<NavTab>(() => tabForPathname(pathname));

  useEffect(() => {
    if (drawerStatus !== 'open') return;
    void countPendingApprovals().then(setPendingApprovals);
    setActiveTab(tabForPathname(pathname));
  }, [drawerStatus, pathname]);

  const activeGroup = useMemo(
    () => NAV_TABS.find((t) => t.id === activeTab) ?? NAV_TABS[0],
    [activeTab],
  );

  const payHasPending = pendingApprovals > 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 12 },
      ]}
    >
      <View style={styles.brandRow}>
        <View style={styles.brandCopy}>
          <Text style={[styles.brand, { color: colors.foreground }]}>Finora</Text>
          <AccountBadge variant='text' />
        </View>
        <Pressable
          accessibilityLabel='Close navigation menu'
          hitSlop={10}
          onPressIn={haptics.selection}
          onPress={() => navigation.closeDrawer()}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: pressed ? colors.muted : 'transparent' },
          ]}
        >
          <Icon
            name='remove'
            size={20}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <ThreadListPrimitive.Root style={styles.root}>
        <Pressable
          onPressIn={haptics.selection}
          onPress={() => {
            aui.threads.switchToNewThread();
            router.push('/');
            navigation.closeDrawer();
          }}
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: pressed ? colors.muted : 'transparent' },
          ]}
        >
          <Icon
            name='compose'
            size={18}
            color={colors.foreground}
          />
          <Text style={[styles.newLabel, { color: colors.foreground }]}>New chat</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Recent</Text>

        <ThreadListPrimitive.Items
          renderItem={({ index }) => (
            <ThreadListItemByIndexProvider
              index={index}
              archived={false}
            >
              <ThreadListItem
                onSelect={() => {
                  router.push('/');
                  navigation.closeDrawer();
                }}
              />
            </ThreadListItemByIndexProvider>
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </ThreadListPrimitive.Root>

      <View
        style={[
          styles.navSection,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={[styles.tabBar, { backgroundColor: colors.muted }]}>
          {NAV_TABS.map((tab) => {
            const selected = tab.id === activeTab;
            const showDot = tab.id === 'pay' && payHasPending;
            return (
              <Pressable
                key={tab.id}
                onPressIn={haptics.selection}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tab,
                  selected && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: selected ? colors.foreground : colors.mutedForeground,
                      fontWeight: selected ? '600' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                {showDot ? (
                  <View style={[styles.tabDot, { backgroundColor: colors.foreground }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {activeGroup.items.map((item) => {
          const href = String(item.href);
          const active = pathname.startsWith(href);
          const showBadge = href === '/approvals' && pendingApprovals > 0;
          return (
            <Pressable
              key={href}
              onPressIn={haptics.selection}
              onPress={() => {
                router.push(item.href);
                navigation.closeDrawer();
              }}
              style={({ pressed }) => [
                styles.navItem,
                (active || pressed) && { backgroundColor: colors.muted },
              ]}
            >
              <Icon
                name={item.icon}
                size={18}
                color={active ? colors.foreground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: colors.foreground,
                    fontWeight: active ? '600' : '400',
                    flex: 1,
                  },
                ]}
              >
                {item.label}
              </Text>
              {showBadge ? (
                <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
                  <Text style={[styles.badgeText, { color: colors.background }]}>
                    {pendingApprovals}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  brandCopy: {
    gap: 1,
  },
  brand: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  root: {
    flex: 1,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 40,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: Radius.md,
  },
  newLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  sectionLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  navSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 8,
    gap: 2,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: 6,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 32,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  tabLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  navLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '700',
  },
});
