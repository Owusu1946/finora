import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import type { Transaction } from '@/components/activity/types';

import { TransactionDetail } from '@/components/activity/TransactionDetail';
import { SwipeBackView } from '@/components/navigation/swipe-back-view';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { getTransaction } from '@/lib/transactions-storage';

export default function TransactionDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void getTransaction(String(id ?? '')).then((next) => {
        if (cancelled) return;
        setTx(next);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  return (
    <SwipeBackView>
      {loading ? (
        <View className='flex-1 bg-background'>
          <LoadingIcon
            style={{ marginTop: 40 }}
            color={colors.mutedForeground}
          />
        </View>
      ) : !tx ? (
        <View className='flex-1 bg-background'>
          <Text className='mt-10 text-center font-sans-medium text-[15px] text-muted-foreground'>
            Transaction not found.
          </Text>
        </View>
      ) : (
        <TransactionDetail tx={tx} />
      )}
    </SwipeBackView>
  );
}
