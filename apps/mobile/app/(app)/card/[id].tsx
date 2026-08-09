import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import { VirtualCardManagePanel } from '@/components/cards/VirtualCardManagePanel';
import { SwipeBackView } from '@/components/navigation/swipe-back-view';
import { AppText as Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
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
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : !card ? (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={[styles.missing, { color: colors.foreground }]}>Card not found</Text>
        </View>
      ) : (
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.content}
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

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: 12,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missing: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 17,
  },
});
