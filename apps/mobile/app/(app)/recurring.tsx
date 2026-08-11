import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RecurringFilter, RecurringPayment } from '@/components/recurring/types';

import { RecurringListItem } from '@/components/recurring/RecurringListItem';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { listRecurring, updateRecurringStatus } from '@/lib/recurring-storage';

const FILTERS: { id: RecurringFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'all', label: 'All' },
];

export default function RecurringScreen() {
  const { colors } = useTheme();
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
    ({ item, index }: { item: RecurringPayment; index: number }) => (
      <RecurringListItem
        item={item}
        isLast={index === filtered.length - 1}
        onPause={handlePause}
        onResume={handleResume}
      />
    ),
    [filtered.length, handlePause, handleResume],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Recurring</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Scheduled supplier and contractor payouts. Create from chat: “Pay TechFlow 780 GBP every
        month”.
      </Text>

      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                haptics.selection();
                setFilter(item.id);
              }}
              style={[styles.chip, { backgroundColor: active ? colors.foreground : colors.muted }]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: active ? colors.background : colors.foreground },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
            No recurring payments yet.
          </Text>
        }
        renderItem={renderRecurring}
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
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 32,
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
