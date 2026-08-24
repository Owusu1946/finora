import { useAui } from '@assistant-ui/react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { listPolicies, setPolicyEnabled, type ApprovalPolicy } from '@/lib/policies-storage';

export default function PoliciesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [policies, setPolicies] = useState<ApprovalPolicy[] | null>(null);

  const refresh = useCallback(async () => {
    setPolicies(await listPolicies());
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
          Approval policies
        </Text>
        <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          Policies are available on Business accounts.
        </Text>
      </View>
    );
  }

  if (!policies) {
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
      data={policies}
      estimatedItemSize={72}
      keyExtractor={(policy) => policy.id}
      recycleItems
      showsVerticalScrollIndicator={false}
      className='flex-1 bg-background'
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior='automatic'
      ListHeaderComponent={
        <View className='gap-2.5 pb-2.5'>
          <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
            Approval policies
          </Text>
          <Text className='mb-1.5 mt-[-4px] font-sans-medium text-[15px] leading-5 text-muted-foreground'>
            Rules that decide when prepares need your passcode. AI never bypasses these.
          </Text>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push('/');
              aui.composer.setText('What happens if I send 2000 USD to a new recipient?');
              aui.composer.send();
            }}
            className='mb-1 min-h-[46px] items-center justify-center rounded-[32px] bg-foreground'
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className='font-sans-semibold text-[15px] text-background'>Simulate in chat</Text>
          </Pressable>
        </View>
      }
      ItemSeparatorComponent={() => <View className='h-2.5' />}
      renderItem={({ item: p }) => (
        <View className='flex-row items-center gap-3 rounded-[26px] border border-border bg-composer p-3.5'>
          <View className='min-w-0 flex-1 gap-0.5'>
            <Text className='font-sans-semibold text-base text-foreground'>{p.name}</Text>
            <Text className='font-sans-medium text-[13px] leading-[18px] text-muted-foreground'>
              {p.rule}
            </Text>
          </View>
          <Switch
            value={p.enabled}
            onValueChange={async (enabled) => {
              haptics.selection();
              await setPolicyEnabled(p.id, enabled);
              await refresh();
            }}
          />
        </View>
      )}
    />
  );
}
