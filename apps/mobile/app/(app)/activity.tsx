import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ActivityFilter, Transaction } from '@/components/activity/types';

import { ActivityFilterTabs } from '@/components/activity/ActivityFilterTabs';
import { ActivityListItem } from '@/components/activity/ActivityListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
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
    setTxs(await listTransactions());
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => void refresh(), [refresh]));

  const filtered = useMemo(
    () => (filter === 'all' ? txs : txs.filter((transaction) => transaction.direction === filter)),
    [filter, txs],
  );

  const handleTransactionPress = useCallback(
    (transaction: Transaction) => router.push(`/transaction/${transaction.id}` as Href),
    [router],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CollapsibleList
        title='Activity'
        data={filtered}
        intro={
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Activity</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Every send, receive, and conversion — tap a row for status, WeWire id, and rail.
            </Text>
          </>
        }
        controls={
          <ActivityFilterTabs
            filter={filter}
            onSelectFilter={setFilter}
          />
        }
        empty={
          !loading ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No transactions yet.
            </Text>
          ) : null
        }
        renderItem={(transaction, _index, isLast) => (
          <ActivityListItem
            tx={transaction}
            isLast={isLast}
            onPress={handleTransactionPress}
          />
        )}
        keyExtractor={(transaction) => transaction.id}
        getItemType={() => 'transaction'}
        onRefresh={refresh}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  empty: {
    paddingTop: 32,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
