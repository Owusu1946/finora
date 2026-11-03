import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import type { VirtualCard, VirtualCardFilter } from '@/components/cards/types';

import { CardListSkeleton } from '@/components/cards/CardListSkeleton';
import { VirtualCardListItem } from '@/components/cards/VirtualCardListItem';
import { CollapsibleList } from '@/components/navigation/collapsible-list';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import {
  clearUnreadVirtualCards,
  loadVirtualCards,
  subscribeVirtualCards,
} from '@/lib/virtual-cards-storage';

const FILTERS: { id: VirtualCardFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'frozen', label: 'Frozen' },
];

export default function CardsScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<VirtualCardFilter>('all');
  const [items, setItems] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { cards: next, error } = await loadVirtualCards();
    setItems(next.filter((c) => c.status !== 'cancelled' || filter === 'all'));
    setLoadError(error);
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
    <View className='flex-1 bg-background'>
      <CollapsibleList
        title='Cards'
        data={filtered}
        intro={
          <View className='mb-4 flex-row items-start gap-3'>
            <View className='flex-1 gap-1.5'>
              <Text className='font-sans-semibold text-[28px] tracking-[-0.6px] text-foreground'>
                Cards
              </Text>
              <Text className='font-sans text-sm leading-5 text-muted-foreground'>
                Issue virtual cards with spend limits. Reveal details with your passcode.
              </Text>
            </View>
            <Pressable
              onPress={createCard}
              className='rounded-full bg-primary px-4 py-2.5'
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className='font-sans-semibold text-sm text-primary-foreground'>New</Text>
            </Pressable>
          </View>
        }
        controls={
          <View
            key={`cards-filters-${isDark ? 'dark' : 'light'}`}
            className='mb-2 flex-row gap-2 bg-background'
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
                  className={cx('rounded-full px-3 py-2', active ? 'bg-foreground' : 'bg-muted')}
                >
                  <Text
                    className={cx(
                      'font-sans-medium text-[13px]',
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
        empty={
          loading ? (
            <CardListSkeleton />
          ) : loadError ? (
            <View className='items-start gap-2 pt-12'>
              <Text className='font-sans-semibold text-[17px] text-foreground'>
                Couldn’t load your cards
              </Text>
              <Text className='font-sans text-sm leading-5 text-muted-foreground'>{loadError}</Text>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  void refresh();
                }}
                className='mt-1 rounded-full bg-muted px-4 py-2.5'
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className='font-sans-semibold text-sm text-foreground'>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View className='gap-2 pt-12'>
              <Text className='font-sans-semibold text-[17px] text-foreground'>No cards yet</Text>
              <Text className='font-sans text-sm leading-5 text-muted-foreground'>
                Load a prepaid USD card from any of your accounts, or ask in chat, e.g. “create a
                card for Netflix with $20”.
              </Text>
            </View>
          )
        }
        renderItem={renderCard}
      />
    </View>
  );
}
