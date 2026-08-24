import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import { VirtualCardManagePanel } from '@/components/cards/VirtualCardManagePanel';
import { SwipeBackView } from '@/components/navigation/swipe-back-view';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { getVirtualCard, subscribeVirtualCards } from '@/lib/virtual-cards-storage';

export default function CardDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<VirtualCard | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setCard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await getVirtualCard(String(id));
    setCard(next);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void refresh();
    return subscribeVirtualCards(() => {
      void refresh();
    });
  }, [refresh]);

  return (
    <SwipeBackView>
      {loading ? (
        <View className='flex-1 items-center justify-center bg-background p-6'>
          <LoadingIcon color={colors.mutedForeground} />
        </View>
      ) : !card ? (
        <View className='flex-1 items-center justify-center bg-background p-6'>
          <Text className='font-sans-semibold text-[17px] text-foreground'>Card not found</Text>
        </View>
      ) : (
        <ScrollView
          className='bg-background'
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <VirtualCardManagePanel
            card={card}
            onChanged={setCard}
          />
        </ScrollView>
      )}
    </SwipeBackView>
  );
}
