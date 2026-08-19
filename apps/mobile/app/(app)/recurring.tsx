import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RecurringFilter, RecurringPayment } from '@/components/recurring/types';

import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { RecurringListItem } from '@/components/recurring/RecurringListItem';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { listRecurring, subscribeRecurring, updateRecurringStatus } from '@/lib/recurring-storage';

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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CollapsibleList
        title='Recurring'
        data={filtered}
        intro={
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Recurring</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Scheduled supplier and contractor payouts. Create from chat: “Pay TechFlow 780 GBP
              every month”.
            </Text>
          </>
        }
        controls={
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
                  style={[
                    styles.chip,
                    { backgroundColor: active ? colors.foreground : colors.muted },
                  ]}
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
        }
        keyExtractor={(item) => item.id}
        onRefresh={refresh}
        refreshing={loading}
        empty={
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
    paddingBottom: 14,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
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
  empty: {
    paddingTop: 32,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});
