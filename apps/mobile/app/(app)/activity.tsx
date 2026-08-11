import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ActivityFilter, Transaction } from '@/components/activity/types';

import { ActivityFilterTabs } from '@/components/activity/ActivityFilterTabs';
import { ActivityListItem } from '@/components/activity/ActivityListItem';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { listTransactions } from '@/lib/transactions-storage';

export default function ActivityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  const filtered = useMemo(() => {
    if (filter === 'all') return txs;
    return txs.filter((t) => t.direction === filter);
  }, [filter, txs]);

  const handleTransactionPress = useCallback(
    (tx: Transaction) => {
      router.push(`/transaction/${tx.id}` as Href);
    },
    [router],
  );
  const renderTransaction = useCallback(
    ({ item, index }: { item: Transaction; index: number }) => (
      <ActivityListItem
        tx={item}
        isLast={index === filtered.length - 1}
        onPress={handleTransactionPress}
      />
    ),
    [filtered.length, handleTransactionPress],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Activity</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Every send, receive, and conversion — tap a row for status, WeWire id, and rail.
      </Text>

      <ActivityFilterTabs
        filter={filter}
        onSelectFilter={setFilter}
      />

      <LegendList
        showsVerticalScrollIndicator={false}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior='automatic'
        recycleItems
        onRefresh={refresh}
        refreshing={loading}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No transactions yet.
          </Text>
        }
        renderItem={renderTransaction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 14,
  },
  list: {
    paddingBottom: 32,
    paddingTop: 4,
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
