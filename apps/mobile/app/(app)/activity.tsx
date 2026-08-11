import { LegendList } from '@legendapp/list/react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, useNavigation, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { ActivityFilter, Transaction } from '@/components/activity/types';

import { ActivityFilterTabs } from '@/components/activity/ActivityFilterTabs';
import { ActivityListItem } from '@/components/activity/ActivityListItem';
import { AccountBadge, HeaderTitleWithAccount } from '@/components/shell/account-badge';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { listTransactions } from '@/lib/transactions-storage';

type ActivityRow =
  | { kind: 'intro' }
  | { kind: 'tabs' }
  | { kind: 'empty' }
  | { kind: 'transaction'; transaction: Transaction };

export default function ActivityScreen() {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const router = useRouter();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await listTransactions();
    setTxs(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () =>
        compactTitleVisible ? <HeaderTitleWithAccount title='Activity' /> : <AccountBadge />,
    });
  }, [compactTitleVisible, navigation]);

  const filtered = useMemo(() => {
    if (filter === 'all') return txs;
    return txs.filter((transaction) => transaction.direction === filter);
  }, [filter, txs]);

  const rows = useMemo<ActivityRow[]>(() => {
    const content: ActivityRow[] = [
      { kind: 'intro' },
      { kind: 'tabs' },
      ...filtered.map((transaction) => ({ kind: 'transaction' as const, transaction })),
    ];
    if (!loading && filtered.length === 0) content.push({ kind: 'empty' });
    return content;
  }, [filtered, loading]);

  const handleTransactionPress = useCallback(
    (transaction: Transaction) => {
      router.push(`/transaction/${transaction.id}` as Href);
    },
    [router],
  );

  const renderRow = useCallback(
    ({ item, index }: { item: ActivityRow; index: number }) => {
      if (item.kind === 'intro') {
        return (
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.foreground }]}>Activity</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Every send, receive, and conversion — tap a row for status, WeWire id, and rail.
            </Text>
          </View>
        );
      }

      if (item.kind === 'tabs') {
        return (
          <View style={[styles.stickyTabs, { backgroundColor: colors.background }]}>
            <ActivityFilterTabs
              filter={filter}
              onSelectFilter={setFilter}
            />
          </View>
        );
      }

      if (item.kind === 'empty') {
        return (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No transactions yet.
          </Text>
        );
      }

      return (
        <View style={styles.row}>
          <ActivityListItem
            tx={item.transaction}
            isLast={index === filtered.length + 1}
            onPress={handleTransactionPress}
          />
        </View>
      );
    },
    [colors, filter, filtered.length, handleTransactionPress],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LegendList
        data={rows}
        renderItem={renderRow}
        keyExtractor={(item, index) =>
          item.kind === 'transaction' ? item.transaction.id : `${item.kind}-${index}`
        }
        getItemType={(item) => item.kind}
        recycleItems
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingTop: headerHeight + 16 }]}
        contentInsetAdjustmentBehavior='never'
        stickyHeaderIndices={[1]}
        stickyHeaderConfig={{ offset: headerHeight }}
        renderScrollComponent={(props) => <Animated.ScrollView {...props} />}
        onStickyHeaderChange={({ index }) => setCompactTitleVisible(index === 1)}
        onRefresh={refresh}
        refreshing={loading}
        progressViewOffset={headerHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  intro: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    paddingTop: 6,
    paddingBottom: 14,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  stickyTabs: {
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  list: {
    paddingBottom: 32,
  },
  row: {
    paddingHorizontal: 20,
  },
  empty: {
    paddingHorizontal: 20,
    paddingTop: 32,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
