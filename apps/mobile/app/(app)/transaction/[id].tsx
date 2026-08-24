import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <LoadingIcon
            style={{ marginTop: 40 }}
            color={colors.mutedForeground}
          />
        </View>
      ) : !tx ? (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <Text style={[styles.missing, { color: colors.mutedForeground }]}>
            Transaction not found.
          </Text>
        </View>
      ) : (
        <TransactionDetail tx={tx} />
      )}
    </SwipeBackView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  missing: {
    marginTop: 40,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
  },
});
