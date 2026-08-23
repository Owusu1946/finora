import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { RecurringFilter, RecurringPayment } from '@/components/recurring/types';

import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { RecurringListItem } from '@/components/recurring/RecurringListItem';
import { AppText as Text } from '@/components/ui/text';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { listRecurring, subscribeRecurring, updateRecurringStatus } from '@/lib/recurring-storage';

const FILTERS: { id: RecurringFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'all', label: 'All' },
];

export default function RecurringScreen() {
  const [filter, setFilter] = useState<RecurringFilter>('active');
  const [items, setItems] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setItems(await listRecurring());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => subscribeRecurring(() => void refresh()), [refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items.filter((r) => r.status !== 'cancelled');
    return items.filter((r) => r.status === filter);
  }, [filter, items]);
  const handlePause = useCallback(
    async (item: RecurringPayment) => {
      await updateRecurringStatus(item.id, 'paused');
      void refresh();
    },
    [refresh],
  );
  const handleResume = useCallback(
    async (item: RecurringPayment) => {
      await updateRecurringStatus(item.id, 'active');
      void refresh();
    },
    [refresh],
  );
  const renderRecurring = useCallback(
    (item: RecurringPayment, _index: number, isLast: boolean) => (
      <RecurringListItem
        item={item}
        isLast={isLast}
        onPause={handlePause}
        onResume={handleResume}
      />
    ),
    [filtered.length, handlePause, handleResume],
  );

  return (
    <View className='flex-1 bg-background'>
      <CollapsibleList
        title='Recurring'
        data={filtered}
        intro={
          <>
            <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
              Recurring
            </Text>
            <Text className='mb-0 mt-1.5 pb-3.5 font-sans-medium text-[15px] leading-5 text-muted-foreground'>
              Scheduled supplier and contractor payouts. Create from chat: “Pay TechFlow 780 GBP
              every month”.
            </Text>
          </>
        }
        controls={
          <View className='flex-row gap-2 pb-2'>
            {FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    haptics.selection();
                    setFilter(item.id);
                  }}
                  className={cx('rounded-full px-3 py-2', active ? 'bg-foreground' : 'bg-muted')}
                >
                  <Text
                    className={cx(
                      'font-sans-semibold text-sm',
                      active ? 'text-background' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
        keyExtractor={(item) => item.id}
        onRefresh={refresh}
        refreshing={loading}
        empty={
          <Text className='pt-8 text-center font-sans-medium text-[15px] leading-5 text-muted-foreground'>
            No recurring payments yet.
          </Text>
        }
        renderItem={renderRecurring}
      />
    </View>
  );
}
