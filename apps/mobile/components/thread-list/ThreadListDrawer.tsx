import type { DrawerContentComponentProps } from '@react-navigation/drawer';

import {
  ThreadListPrimitive,
  ThreadListItemByIndexProvider,
  useAui,
} from '@assistant-ui/react-native';
import { useDrawerStatus } from '@react-navigation/drawer';
import { type Href, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui/icon-mappings';

import { AccountBadge } from '@/components/shell/account-badge';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { countPendingApprovals } from '@/lib/approvals-storage';
import { haptics } from '@/lib/haptics';
import type { TranslationKey } from '@/lib/i18n';
import { useSettings } from '@/lib/settings-context';
import { hasUnreadVirtualCards, subscribeVirtualCards } from '@/lib/virtual-cards-storage';

import { ThreadListItem } from './ThreadListItem';

type NavTab = 'money' | 'pay' | 'more';

type NavItem = { href: Href; key: TranslationKey; icon: IconName };

const MONEY_ITEMS_BASE: NavItem[] = [
  { href: '/wallets', key: 'nav_wallets', icon: 'wallet' },
  { href: '/cards', key: 'nav_cards', icon: 'card' },
  { href: '/activity', key: 'nav_activity', icon: 'activity' },
];

const MONEY_ITEMS_BUSINESS: NavItem[] = [{ href: '/treasury', key: 'nav_treasury', icon: 'wallet' }];

const PAY_ITEMS_BASE: NavItem[] = [
  { href: '/approvals', key: 'nav_approvals', icon: 'shield' },
  { href: '/invoices', key: 'nav_invoices', icon: 'file' },
  { href: '/recurring', key: 'nav_recurring', icon: 'reload' },
];

const PAY_ITEMS_BUSINESS: NavItem[] = [
  { href: '/payroll', key: 'nav_payroll', icon: 'contacts' },
  { href: '/suppliers', key: 'nav_suppliers', icon: 'bank' },
  { href: '/beneficiaries', key: 'nav_beneficiaries', icon: 'bank' },
  { href: '/expenses', key: 'nav_expenses', icon: 'card' },
];

const MORE_ITEMS_BASE: NavItem[] = [
  { href: '/contacts', key: 'nav_contacts', icon: 'contacts' },
  { href: '/integrations', key: 'nav_integrations', icon: 'integrations' },
  { href: '/settings', key: 'nav_settings', icon: 'settings' },
];

const MORE_ITEMS_BUSINESS: NavItem[] = [
  { href: '/automations', key: 'nav_automations', icon: 'reload' },
  { href: '/policies', key: 'nav_policies', icon: 'shield' },
];

function buildNavTabs(business: boolean) {
  return [
    {
      id: 'money' as const,
      labelKey: 'nav_wallets' as TranslationKey,
      items: business ? [...MONEY_ITEMS_BASE, ...MONEY_ITEMS_BUSINESS] : MONEY_ITEMS_BASE,
    },
    {
      id: 'pay' as const,
      labelKey: 'nav_approvals' as TranslationKey,
      items: business ? [...PAY_ITEMS_BASE, ...PAY_ITEMS_BUSINESS] : PAY_ITEMS_BASE,
    },
    {
      id: 'more' as const,
      labelKey: 'settings_section_more' as TranslationKey,
      items: business ? [...MORE_ITEMS_BASE, ...MORE_ITEMS_BUSINESS] : MORE_ITEMS_BASE,
    },
  ];
}

function tabForPathname(pathname: string, tabs: ReturnType<typeof buildNavTabs>): NavTab {
  for (const tab of tabs) {
    if (tab.items.some((item) => pathname.startsWith(String(item.href)))) {
      return tab.id;
    }
  }
  return 'money';
}

export function ThreadListDrawer({ navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const { t } = useSettings();
  const aui = useAui();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const drawerStatus = useDrawerStatus();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadCards, setUnreadCards] = useState(false);
  const [business, setBusiness] = useState(() => isBusinessAccount());
  const navTabs = useMemo(() => buildNavTabs(business), [business]);
  const [activeTab, setActiveTab] = useState<NavTab>(() =>
    tabForPathname(pathname, buildNavTabs(isBusinessAccount())),
  );

  useEffect(() => {
    if (drawerStatus !== 'open') return;
    const nextBusiness = isBusinessAccount();
    setBusiness(nextBusiness);
    void countPendingApprovals().then(setPendingApprovals);
    setActiveTab(tabForPathname(pathname, buildNavTabs(nextBusiness)));
  }, [drawerStatus, pathname]);

  useEffect(() => {
    const refreshUnreadCards = () => void hasUnreadVirtualCards().then(setUnreadCards);
    refreshUnreadCards();
    return subscribeVirtualCards(refreshUnreadCards);
  }, []);

  const activeGroup = useMemo(
    () => navTabs.find((t) => t.id === activeTab) ?? navTabs[0],
    [activeTab, navTabs],
  );

  const payHasPending = pendingApprovals > 0;
  const selectThread = useCallback(() => {
    router.push('/');
    navigation.closeDrawer();
  }, [navigation, router]);
  const renderThread = useCallback(
    ({ index }: { index: number }) => (
      <ThreadListItemByIndexProvider
        index={index}
        archived={false}
      >
        <ThreadListItem onSelect={selectThread} />
      </ThreadListItemByIndexProvider>
    ),
    [selectThread],
  );

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
          renderItem={renderThread}
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
          {navTabs.map((tab) => {
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
                  {t(tab.labelKey)}
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
          const showApprovalBadge = href === '/approvals' && pendingApprovals > 0;
          const showCardBadge = href === '/cards' && unreadCards;
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
                {t(item.key)}
              </Text>
              {showApprovalBadge ? (
                <View style={[styles.badge, { backgroundColor: colors.foreground }]}>
                  <Text style={[styles.badgeText, { color: colors.background }]}>
                    {pendingApprovals}
                  </Text>
                </View>
              ) : showCardBadge ? (
                <View style={[styles.unreadDot, { backgroundColor: colors.foreground }]} />
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
});
