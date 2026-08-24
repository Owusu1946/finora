import type { DrawerContentComponentProps } from '@react-navigation/drawer';

import {
  ThreadListPrimitive,
  ThreadListItemByIndexProvider,
  useAui,
} from '@assistant-ui/react-native';
import { useDrawerStatus } from '@react-navigation/drawer';
import { type Href, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui/icon-mappings';
import type { TranslationKey } from '@/lib/i18n';

import { AccountBadge } from '@/components/shell/account-badge';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { countPendingApprovals } from '@/lib/approvals-storage';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';
import { usePressGuard } from '@/lib/use-press-guard';
import { hasUnreadVirtualCards, subscribeVirtualCards } from '@/lib/virtual-cards-storage';

import { ThreadListItem } from './ThreadListItem';

type NavTab = 'money' | 'pay' | 'more';

type NavItem = { href: Href; key: TranslationKey; icon: IconName };

const MONEY_ITEMS_BASE: NavItem[] = [
  { href: '/wallets', key: 'nav_wallets', icon: 'wallet' },
  { href: '/cards', key: 'nav_cards', icon: 'card' },
  { href: '/activity', key: 'nav_activity', icon: 'activity' },
];

const MONEY_ITEMS_BUSINESS: NavItem[] = [
  { href: '/treasury', key: 'nav_treasury', icon: 'wallet' },
];

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
  const { t } = useSettings();
  const { colors } = useTheme();
  const aui = useAui();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const drawerStatus = useDrawerStatus();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadCards, setUnreadCards] = useState(false);
  const didReloadForOpenRef = useRef(false);
  const [business, setBusiness] = useState(() => isBusinessAccount());
  const navTabs = useMemo(() => buildNavTabs(business), [business]);
  const [activeTab, setActiveTab] = useState<NavTab>(() =>
    tabForPathname(pathname, buildNavTabs(isBusinessAccount())),
  );
  const navigateOnce = usePressGuard();

  useEffect(() => {
    if (drawerStatus === 'closed') {
      didReloadForOpenRef.current = false;
      return;
    }
    if (!didReloadForOpenRef.current) {
      didReloadForOpenRef.current = true;
      void aui.threads.reload();
    }
    const nextBusiness = isBusinessAccount();
    setBusiness(nextBusiness);
    void countPendingApprovals().then(setPendingApprovals);
    setActiveTab(tabForPathname(pathname, buildNavTabs(nextBusiness)));
  }, [aui, drawerStatus, pathname]);

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
    navigateOnce(() => {
      router.push('/');
      navigation.closeDrawer();
    });
  }, [navigation, navigateOnce, router]);
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
      className='flex-1 bg-background'
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className='mb-3 flex-row items-center justify-between gap-2.5 px-5'>
        <View className='gap-px'>
          <Text className='font-sans text-[21px] font-bold tracking-[-0.4px] text-foreground'>
            Finora
          </Text>
          <AccountBadge variant='text' />
        </View>
        <Pressable
          accessibilityLabel='Close navigation menu'
          hitSlop={10}
          onPressIn={haptics.selection}
          onPress={() => navigation.closeDrawer()}
          className='h-8 w-8 items-center justify-center rounded-full active:bg-muted'
        >
          <Icon
            name='remove'
            size={20}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <ThreadListPrimitive.Root className='flex-1'>
        <Pressable
          onPressIn={haptics.selection}
          onPress={() => {
            aui.threads.switchToNewThread();
            navigateOnce(() => {
              router.push('/');
              navigation.closeDrawer();
            });
          }}
          className='mx-2 mb-1 h-10 flex-row items-center gap-2.5 rounded-[18px] px-3 active:bg-muted'
        >
          <Icon
            name='compose'
            size={18}
            color={colors.foreground}
          />
          <Text className='font-sans-medium text-base tracking-[-0.2px] text-foreground'>
            New chat
          </Text>
        </Pressable>

        <Text className='px-5 pb-1.5 pt-3 font-sans-medium text-[13px] text-muted-foreground'>
          Recent
        </Text>

        <ThreadListPrimitive.Items
          renderItem={renderThread}
          className='flex-1'
          contentContainerClassName='pb-2'
          showsVerticalScrollIndicator={false}
        />
      </ThreadListPrimitive.Root>

      <View
        className='gap-0.5 border-t border-border px-2 pt-2.5'
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className='mb-1.5 flex-row gap-0.5 rounded-[18px] bg-muted p-[3px]'>
          {navTabs.map((tab) => {
            const selected = tab.id === activeTab;
            const showDot = tab.id === 'pay' && payHasPending;
            return (
              <Pressable
                key={tab.id}
                onPressIn={haptics.selection}
                onPress={() => setActiveTab(tab.id)}
                className={cx(
                  'h-8 flex-1 flex-row items-center justify-center gap-[5px] rounded-[14px] border border-transparent',
                  selected && 'border-border bg-card',
                )}
              >
                <Text
                  className={cx(
                    'text-sm tracking-[-0.2px]',
                    selected
                      ? 'font-sans-semibold text-foreground'
                      : 'font-sans-medium text-muted-foreground',
                  )}
                >
                  {t(tab.labelKey)}
                </Text>
                {showDot ? <View className='h-1.5 w-1.5 rounded-full bg-foreground' /> : null}
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
                navigateOnce(() => router.push(item.href));
                navigation.closeDrawer();
              }}
              className={cx(
                'h-10 flex-row items-center gap-2.5 rounded-[18px] px-3 active:bg-muted',
                active && 'bg-muted',
              )}
            >
              <Icon
                name={item.icon}
                size={18}
                color={active ? colors.foreground : colors.mutedForeground}
              />
              <Text
                className={cx(
                  'flex-1 text-base tracking-[-0.2px] text-foreground',
                  active ? 'font-sans-semibold' : 'font-sans',
                )}
              >
                {t(item.key)}
              </Text>
              {showApprovalBadge ? (
                <View className='min-w-5 h-5 items-center justify-center rounded-full bg-foreground px-1.5'>
                  <Text className='font-sans text-xs font-bold text-background'>
                    {pendingApprovals}
                  </Text>
                </View>
              ) : showCardBadge ? (
                <View className='mr-2 h-2 w-2 rounded-full bg-foreground' />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
