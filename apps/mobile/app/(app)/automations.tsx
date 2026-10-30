import type { AutomationRecord } from '@finora/shared';

import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { AutomationBuilderSheet } from '@/components/automations/AutomationBuilderSheet';
import { AutomationCard, timeAgo } from '@/components/automations/AutomationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import {
  deleteRemoteAutomation,
  listAutomationActivity,
  listRemoteAutomations,
  runRemoteAutomation,
  updateRemoteAutomation,
  type AutomationActivity,
} from '@/lib/automations-api';
import { haptics } from '@/lib/haptics';
import { automationsChatId, requestOpenThread } from '@/lib/open-thread';

const ACTIVITY_SHOWN = 8;

const ACTIVITY_LABEL: Record<AutomationActivity['status'], string> = {
  notified: 'Reminded you',
  prepared_approval: 'Ready to prepare',
  failed: 'Failed',
  skipped_condition: 'Checked, nothing to do',
  duplicate: 'Skipped, ran recently',
  evaluated: 'Checked',
};

export default function AutomationsScreen() {
  const { colors } = useTheme();
  const { getToken, userId } = useAuth();
  const [automations, setAutomations] = useState<AutomationRecord[] | null>(null);
  const [activity, setActivity] = useState<AutomationActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [builderVisible, setBuilderVisible] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [items, recent] = await Promise.all([
        listRemoteAutomations(getToken),
        listAutomationActivity(getToken).catch(() => []),
      ]);
      setAutomations(items);
      setActivity(recent.slice(0, ACTIVITY_SHOWN));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load automations.');
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const openChat = () => {
    if (!userId) return;
    haptics.selection();
    requestOpenThread(automationsChatId(userId));
  };

  const act = async (automation: AutomationRecord, task: () => Promise<unknown>) => {
    haptics.selection();
    setBusyId(automation.id);
    try {
      await task();
      await refresh();
    } catch (caught) {
      haptics.error();
      Alert.alert(
        'Something went wrong',
        caught instanceof Error ? caught.message : 'Try again in a moment.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const runNow = (automation: AutomationRecord) =>
    act(automation, async () => {
      await runRemoteAutomation(getToken, automation.id);
      haptics.success();
      Alert.alert(
        'Running now',
        'The result will appear in your Automations chat in a few seconds.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Open chat', onPress: openChat },
        ],
      );
    });

  const confirmDelete = (automation: AutomationRecord) =>
    Alert.alert(`Delete "${automation.name}"?`, 'It stops running. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void act(automation, () => deleteRemoteAutomation(getToken, automation.id)),
      },
    ]);

  if (!isBusinessAccount()) {
    return (
      <View className='flex-1 bg-background px-5 pt-4'>
        <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
          Automations
        </Text>
        <Text className='mt-1 font-sans-medium text-[15px] leading-5 text-muted-foreground'>
          Automations are available on Business accounts.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className='flex-1 bg-background'
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 12 }}
        contentInsetAdjustmentBehavior='automatic'
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void refresh().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <View className='gap-1'>
          <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-foreground'>
            Automations
          </Text>
          <Text className='font-sans-medium text-[15px] leading-5 text-muted-foreground'>
            Rules that remind you or prepare actions. Money only moves after you approve it.
          </Text>
        </View>

        <View className='flex-row gap-2'>
          <Pressable
            accessibilityRole='button'
            onPress={() => {
              haptics.selection();
              setBuilderVisible(true);
            }}
            className='min-h-[46px] flex-1 items-center justify-center rounded-full bg-foreground px-4 active:opacity-85'
          >
            <Text className='font-sans-semibold text-[15px] text-background'>New automation</Text>
          </Pressable>
          <Pressable
            accessibilityRole='button'
            onPress={openChat}
            className='min-h-[46px] flex-1 items-center justify-center rounded-full bg-muted px-4 active:opacity-75'
          >
            <Text className='font-sans-semibold text-[15px] text-foreground'>Automations chat</Text>
          </Pressable>
        </View>

        {automations === null ? (
          <View className='min-h-[160px] items-center justify-center'>
            {error ? (
              <Pressable
                onPress={() => void refresh()}
                className='items-center gap-1 px-6 active:opacity-70'
              >
                <Text className='text-center font-sans-medium text-[15px] text-muted-foreground'>
                  {error}
                </Text>
                <Text className='font-sans-semibold text-[15px] text-foreground'>Try again</Text>
              </Pressable>
            ) : (
              <LoadingIcon color={colors.mutedForeground} />
            )}
          </View>
        ) : automations.length === 0 ? (
          <View
            className='gap-1.5 rounded-[26px] border border-border bg-composer p-5'
            style={{ borderCurve: 'continuous' }}
          >
            <Text className='font-sans-semibold text-[16px] text-foreground'>
              No automations yet
            </Text>
            <Text className='font-sans text-[14px] leading-5 text-muted-foreground'>
              Create one here, or ask Finora in chat, e.g. “Every Monday at 8, remind me to check
              sales” or “On the 25th, prepare rent to Kwame”.
            </Text>
          </View>
        ) : (
          automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              busy={busyId === automation.id}
              onRun={() => void runNow(automation)}
              onToggle={() =>
                void act(automation, () =>
                  updateRemoteAutomation(getToken, {
                    id: automation.id,
                    status: automation.status === 'active' ? 'paused' : 'active',
                  }),
                )
              }
              onDelete={() => confirmDelete(automation)}
            />
          ))
        )}

        {activity.length > 0 ? (
          <View className='mt-3 gap-2'>
            <Text className='px-1 font-sans-semibold text-[13px] uppercase tracking-[0.4px] text-muted-foreground'>
              Recent activity
            </Text>
            <View
              className='rounded-[26px] border border-border bg-composer px-4 py-1'
              style={{ borderCurve: 'continuous' }}
            >
              {activity.map((item, index) => (
                <Pressable
                  key={item.id}
                  disabled={!item.chatId}
                  onPress={() => item.chatId && requestOpenThread(item.chatId)}
                  className={`gap-0.5 py-3 active:opacity-75 ${index > 0 ? 'border-t border-border' : ''}`}
                >
                  <View className='flex-row items-center gap-2'>
                    <Text
                      className='flex-1 font-sans-semibold text-[14px] text-foreground'
                      numberOfLines={1}
                    >
                      {item.automationName}
                    </Text>
                    <Text className='font-sans text-[12px] text-muted-foreground'>
                      {timeAgo(item.createdAt)}
                    </Text>
                  </View>
                  <Text
                    className={`font-sans text-[13px] ${item.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
                    numberOfLines={2}
                  >
                    {ACTIVITY_LABEL[item.status]} · {item.summary}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <AutomationBuilderSheet
        visible={builderVisible}
        onClose={() => setBuilderVisible(false)}
        onCreated={() => {
          setBuilderVisible(false);
          void refresh();
        }}
      />
    </>
  );
}
