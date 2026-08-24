import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import type { ActivityFilter, Transaction } from '@/components/activity/types';

import { ActivityFilterTabs } from '@/components/activity/ActivityFilterTabs';
import { ActivityListItem } from '@/components/activity/ActivityListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { AppText as Text } from '@/components/ui/text';
import { listTransactions } from '@/lib/transactions-storage';

export default function ActivityScreen() {
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
    <View className='flex-1 bg-background'>
      <CollapsibleList
        title='Activity'
        data={filtered}
        intro={
          <>
            <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
              Activity
            </Text>
            <Text className='pb-3.5 pt-1.5 font-sans-medium text-[15px] leading-5 text-muted-foreground'>
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
            <Text className='pt-8 text-center font-sans-medium text-[15px] leading-5 text-muted-foreground'>
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
