import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { getTreasuryOverview, type TreasuryOverview } from '@/lib/treasury';

export default function TreasuryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [overview, setOverview] = useState<TreasuryOverview | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getTreasuryOverview().then(setOverview);
    }, []),
  );

  if (!isBusinessAccount()) {
    return (
      <View className='flex-1 bg-background px-5 pt-4'>
        <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
          Treasury
        </Text>
        <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          Treasury is available on Business accounts. Switch in Settings.
        </Text>
      </View>
    );
  }

  if (!overview) {
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      className='flex-1 bg-background'
      contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 }}
      contentInsetAdjustmentBehavior='automatic'
    >
      <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
        Treasury
      </Text>
      <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
        Cash position and upcoming business outflows. Settlement still goes through approval.
      </Text>

      <View className='gap-2 rounded-[26px] border border-border bg-composer p-4'>
        <Text className='font-sans-semibold text-[13px] text-muted-foreground'>
          Total (USD eq.)
        </Text>
        <Text className='font-sans text-[28px] font-bold tracking-[-0.5px] text-foreground'>
          {formatPaymentAmount(overview.totalUsd, 'USD')}
        </Text>
        <Pressable
          onPress={() => {
            haptics.selection();
            router.push('/');
            aui.composer.setText('Show treasury overview');
            aui.composer.send();
          }}
          className='mt-1 min-h-[46px] items-center justify-center rounded-[32px] bg-foreground'
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Text className='font-sans-semibold text-[15px] text-background'>Ask in chat</Text>
        </Pressable>
      </View>

      {overview.balances.map((b) => (
        <View
          key={b.currency}
          className='flex-row items-center gap-2.5 rounded-[26px] border border-border bg-composer p-3.5'
        >
          <Text className='font-sans-semibold text-base text-foreground'>{b.currency}</Text>
          <Text className='font-sans-semibold text-[15px] text-foreground'>
            {formatPaymentAmount(b.balance, b.currency)}
          </Text>
        </View>
      ))}

      <Text className='mt-2 font-sans-semibold text-[13px] text-muted-foreground'>Upcoming</Text>
      {overview.upcomingOutflows.slice(0, 6).map((item, i) => (
        <View
          key={`${item.label}-${i}`}
          className='flex-row items-center gap-2.5 rounded-[26px] border border-border bg-composer p-3.5'
        >
          <Text
            className='flex-1 font-sans-semibold text-base text-foreground'
            numberOfLines={1}
          >
            {item.label}
          </Text>
          <Text className='font-sans-semibold text-[15px] text-foreground'>
            {formatPaymentAmount(item.amount, item.currency)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
