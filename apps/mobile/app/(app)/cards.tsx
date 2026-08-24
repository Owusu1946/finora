import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import type { VirtualCard, VirtualCardFilter } from '@/components/cards/types';

import { VirtualCardListItem } from '@/components/cards/VirtualCardListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import {
  clearUnreadVirtualCards,
  listVirtualCards,
  subscribeVirtualCards,
} from '@/lib/virtual-cards-storage';

const FILTERS: { id: VirtualCardFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'frozen', label: 'Frozen' },
];

export default function CardsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<VirtualCardFilter>('all');
  const [items, setItems] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await listVirtualCards();
    setItems(next.filter((c) => c.status !== 'cancelled' || filter === 'all'));
    setLoading(false);
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      if (AppState.currentState === 'active') void clearUnreadVirtualCards();
      const unsubscribe = subscribeVirtualCards(() => {
        void refresh();
      });
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void clearUnreadVirtualCards();
      });
      return () => {
        unsubscribe();
        subscription.remove();
      };
    }, [refresh]),
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return items.filter((c) => c.status !== 'cancelled');
    return items.filter((c) => c.status === filter);
  }, [filter, items]);

  const createCard = () => {
    haptics.selection();
    router.push('/virtual-card' as Href);
  };
  const openCard = useCallback(
    (id: string) => {
      router.push(`/card/${id}` as Href);
    },
    [router],
  );
  const renderCard = useCallback(
    (item: VirtualCard, _index: number, isLast: boolean) => (
      <VirtualCardListItem
        card={item}
        isLast={isLast}
        onPress={openCard}
      />
    ),
    [filtered.length, openCard],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CollapsibleList
        title='Cards'
        data={filtered}
        intro={
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.foreground }]}>Cards</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Issue virtual cards with spend limits. Reveal details with your passcode.
              </Text>
            </View>
            <Pressable
              onPress={createCard}
              style={({ pressed }) => [
                styles.newBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.newBtnText, { color: colors.primaryForeground }]}>New</Text>
            </Pressable>
          </View>
        }
        controls={
          <View
            key={`cards-filters-${isDark ? 'dark' : 'light'}`}
            style={[styles.filters, { backgroundColor: colors.background }]}
          >
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
        empty={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {loading ? 'Loading…' : 'No cards yet'}
            </Text>
            {!loading ? (
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Start with a purpose, currency, and spend limit, or type “create virtual card” in
                chat for the guided chat flow.
              </Text>
            ) : null}
          </View>
        }
        renderItem={renderCard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 28,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  newBtn: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  newBtnText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  list: {
    paddingBottom: 40,
  },
  empty: {
    paddingTop: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 17,
  },
  emptySub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});
