import { useAui } from '@assistant-ui/react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { listExpenses, type BusinessExpense } from '@/lib/expenses-storage';
import { haptics } from '@/lib/haptics';

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [items, setItems] = useState<BusinessExpense[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void listExpenses().then(setItems);
    }, []),
  );

  const total = useMemo(() => (items ?? []).reduce((s, e) => s + e.amount, 0), [items]);

  if (!isBusinessAccount()) {
    return (
      <View className='flex-1 bg-background px-5 pt-4'>
        <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
          Expenses
        </Text>
        <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          Business expenses are available on Business accounts.
        </Text>
      </View>
    );
  }

  if (!items) {
    return (
      <View className='flex-1 bg-background'>
        <LoadingIcon
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  return (
    <LegendList
      data={items}
      keyExtractor={(item) => item.id}
      recycleItems
      showsVerticalScrollIndicator={false}
      className='flex-1 bg-background'
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior='automatic'
      ListHeaderComponent={
        <View className='gap-2.5 pb-2.5'>
          <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
            Expenses
          </Text>
          <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
            Card and vendor spend this month · {formatPaymentAmount(total, 'USD')}
          </Text>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/');
              aui.composer.setText('Show business expenses this month');
              aui.composer.send();
            }}
            className='mb-1 min-h-[46px] items-center justify-center rounded-[32px] bg-foreground'
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className='font-sans-semibold text-[15px] text-background'>Review in chat</Text>
          </Pressable>
        </View>
      }
      ItemSeparatorComponent={() => <View className='h-2.5' />}
      renderItem={({ item: e }) => (
        <View className='flex-row items-center gap-2.5 rounded-[26px] border border-border bg-composer p-3.5'>
          <View className='min-w-0 flex-1 gap-0.5'>
            <Text className='font-sans-semibold text-base text-foreground'>{e.merchant}</Text>
            <Text className='font-sans-medium text-[13px] text-muted-foreground'>
              {e.category}
              {e.cardLabel ? ` · ${e.cardLabel}` : ''}
            </Text>
          </View>
          <Text className='font-sans-semibold text-[15px] text-foreground'>
            {formatPaymentAmount(e.amount, e.currency)}
          </Text>
        </View>
      )}
    />
  );
}
