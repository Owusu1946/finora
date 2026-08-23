import { useAui } from '@assistant-ui/react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { listSuppliers, type Supplier } from '@/lib/suppliers-storage';

export default function SuppliersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);

  const refresh = useCallback(async () => {
    setSuppliers(await listSuppliers());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!isBusinessAccount()) {
    return (
      <View className='flex-1 bg-background px-5 pt-4'>
        <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
          Suppliers
        </Text>
        <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          Suppliers are available on Business accounts. Switch account type in Settings.
        </Text>
      </View>
    );
  }

  if (!suppliers) {
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
      data={suppliers}
      keyExtractor={(supplier) => supplier.id}
      recycleItems
      showsVerticalScrollIndicator={false}
      className='flex-1 bg-background'
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior='automatic'
      ListHeaderComponent={
        <View className='gap-2.5 pb-2.5'>
          <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
            Suppliers
          </Text>
          <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
            Saved vendor beneficiaries. Pay from chat — each payout still needs your passcode.
          </Text>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/');
              aui.composer.setText('Show suppliers');
              aui.composer.send();
            }}
            className='min-h-[46px] items-center justify-center rounded-[32px] bg-foreground'
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className='font-sans-semibold text-[15px] text-background'>Review in chat</Text>
          </Pressable>
        </View>
      }
      ItemSeparatorComponent={() => <View className='h-2.5' />}
      renderItem={({ item: supplier }) => (
        <View className='gap-3 rounded-[26px] border border-border bg-composer p-3.5'>
          <View className='flex-row items-start gap-2.5'>
            <View className='min-w-0 flex-1 gap-0.5'>
              <Text className='font-sans-semibold text-base text-foreground'>{supplier.name}</Text>
              <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                {supplier.destination.label} · {supplier.destination.value}
              </Text>
              {supplier.notes ? (
                <Text className='font-sans-medium text-[13px] text-muted-foreground'>
                  {supplier.notes}
                </Text>
              ) : null}
            </View>
            {supplier.defaultAmount != null ? (
              <Text className='font-sans-semibold text-[15px] text-foreground'>
                {formatPaymentAmount(supplier.defaultAmount, supplier.currency)}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              haptics.selection();
              const amount = supplier.defaultAmount ?? 500;
              router.push('/');
              aui.composer.setText(`Pay ${supplier.name} ${amount} ${supplier.currency}`);
              aui.composer.send();
            }}
            className='min-h-[42px] items-center justify-center rounded-[32px] border border-border'
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className='font-sans-semibold text-[15px] text-foreground'>Pay in chat</Text>
          </Pressable>
        </View>
      )}
    />
  );
}
