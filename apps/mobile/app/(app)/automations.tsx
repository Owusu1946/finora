import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { listAutomations, setAutomationStatus, type Automation } from '@/lib/automations-storage';
import { listRemoteAutomations, updateRemoteAutomation } from '@/lib/automations-api';
import { haptics } from '@/lib/haptics';

export default function AutomationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const { getToken } = useAuth();
  const [items, setItems] = useState<Automation[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const remote = await listRemoteAutomations(getToken);
      setItems(
        remote.map((item) => ({
          id: item.id,
          name: item.name,
          trigger: item.trigger.type,
          action: item.action.type,
          status: item.status === 'disabled' ? 'paused' : item.status,
          source: 'api' as const,
          remote: item,
        })),
      );
    } catch {
      setItems(await listAutomations());
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!isBusinessAccount()) {
    return (
      <View className='flex-1 bg-background px-5 pt-4'>
        <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
          Automations
        </Text>
        <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          Automations are available on Business accounts.
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
      estimatedItemSize={96}
      keyExtractor={(item) => item.id}
      recycleItems
      showsVerticalScrollIndicator={false}
      className='flex-1 bg-background'
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior='automatic'
      ListHeaderComponent={
        <View className='gap-2.5 pb-2.5'>
          <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
            Automations
          </Text>
          <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
            Rules can prepare actions only — money still needs your approval.
          </Text>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/');
              aui.composer.setText('Show my automations');
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
      renderItem={({ item: a }) => (
        <View className='gap-1.5 rounded-[26px] border border-border bg-composer p-3.5'>
          <Text className='font-sans-semibold text-base text-foreground'>{a.name}</Text>
          <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
            When {a.trigger} → {a.action}
          </Text>
          <Pressable
            onPress={async () => {
              haptics.selection();
              const nextStatus = a.status === 'active' ? 'paused' : 'active';
              if (a.source === 'api') {
                await updateRemoteAutomation(getToken, { id: a.id, status: nextStatus });
              } else {
                await setAutomationStatus(a.id, nextStatus);
              }
              await refresh();
            }}
            className='mt-1 min-h-[42px] items-center justify-center rounded-[32px] border border-border'
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className='font-sans-semibold text-[15px] text-foreground'>
              {a.status === 'active' ? 'Pause' : 'Resume'}
            </Text>
          </Pressable>
        </View>
      )}
    />
  );
}
