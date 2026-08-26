import type { CreateAutomationInput } from '@finora/shared';

import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { LoadingIcon } from '@/components/ui/loading-icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import {
  matchingAutomationContext,
  rejectingAutomationContext,
  triggerSupportLabel,
} from '@/lib/automation-test-context';
import {
  createRemoteAutomation,
  listRemoteAutomations,
  runRemoteAutomation,
  testRemoteAutomation,
  updateRemoteAutomation,
} from '@/lib/automations-api';
import { listAutomations, setAutomationStatus, type Automation } from '@/lib/automations-storage';
import { haptics } from '@/lib/haptics';

type BuilderTrigger = 'schedule' | 'balance_threshold';
type BuilderAction = 'notify_chat' | 'prepare_payment' | 'prepare_conversion';

const inputStyle = {
  borderWidth: 1,
  borderColor: '#e4e4e7',
  borderRadius: 14,
  paddingHorizontal: 14,
  height: 48,
  fontSize: 16,
};

export default function AutomationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const { getToken } = useAuth();
  const [items, setItems] = useState<Automation[] | null>(null);
  const [builderVisible, setBuilderVisible] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const runDryTest = useCallback(
    async (automation: NonNullable<Automation['remote']>, expectation: 'match' | 'reject') => {
      const context =
        expectation === 'match'
          ? matchingAutomationContext(automation)
          : rejectingAutomationContext(automation);
      if (!context) {
        Alert.alert(
          'No rejection case',
          'This trigger intentionally accepts every sender. Add a condition to test rejection.',
        );
        return;
      }
      const result = await testRemoteAutomation(getToken, automation.id, { context });
      const passed = expectation === 'match' ? result.matched : !result.matched;
      Alert.alert(
        passed ? 'Test passed' : 'Test exposed a configuration issue',
        `${expectation === 'match' ? 'Expected a match.' : 'Expected a rejection.'} ${result.triggerMatches ? 'The trigger matched.' : 'The trigger did not match.'} ${result.failedConditions.length} condition(s) failed.\n\nNo action was created or executed.`,
      );
    },
    [getToken],
  );

  const runSafeAction = useCallback(
    async (automation: NonNullable<Automation['remote']>) => {
      const result = await testRemoteAutomation(getToken, automation.id, {
        context: matchingAutomationContext(automation),
      });
      if (!result.matched) {
        Alert.alert(
          'Rule cannot match',
          'The generated matching case still failed. Review conflicting trigger and condition settings before running it.',
        );
        return;
      }
      await runRemoteAutomation(getToken, automation.id, {
        context: matchingAutomationContext(automation),
      });
      Alert.alert(
        'Safe run queued',
        automation.action.type === 'notify_chat'
          ? 'This will create a notification activity. Keep Finora open to receive the Expo Go local notification.'
          : 'This will prepare a pending approval only. It will not move money.',
      );
    },
    [getToken],
  );

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
    <>
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
                setBuilderVisible(true);
              }}
              className='mb-1 min-h-[46px] items-center justify-center rounded-[32px] bg-primary'
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text className='font-sans-semibold text-[15px] text-primary-foreground'>
                Create automation
              </Text>
            </Pressable>
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
            <View className='mt-1 flex-row gap-2'>
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
                className='min-h-[42px] flex-1 items-center justify-center rounded-[32px] border border-border'
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text className='font-sans-semibold text-[14px] text-foreground'>
                  {a.status === 'active' ? 'Pause' : 'Resume'}
                </Text>
              </Pressable>
            </View>
            {a.source === 'api' && a.remote ? (
              <View className='mt-1 gap-2 rounded-[18px] bg-muted p-2.5'>
                <Text className='font-sans-medium text-[12px] leading-4 text-muted-foreground'>
                  {triggerSupportLabel(a.remote)}
                </Text>
                <View className='flex-row gap-2'>
                  {[
                    { label: 'Match', action: () => runDryTest(a.remote!, 'match') },
                    { label: 'Reject', action: () => runDryTest(a.remote!, 'reject') },
                    { label: 'Safe run', action: () => runSafeAction(a.remote!) },
                  ].map((test) => (
                    <Pressable
                      key={test.label}
                      disabled={
                        testingId === a.id || (test.label === 'Safe run' && a.status !== 'active')
                      }
                      onPress={async () => {
                        haptics.selection();
                        setTestingId(a.id);
                        try {
                          await test.action();
                        } catch (error) {
                          Alert.alert(
                            'Automation test failed',
                            error instanceof Error ? error.message : 'Try again.',
                          );
                        } finally {
                          setTestingId(null);
                        }
                      }}
                      className='min-h-[40px] flex-1 items-center justify-center rounded-[24px] bg-composer'
                      style={{
                        opacity:
                          testingId === a.id || (test.label === 'Safe run' && a.status !== 'active')
                            ? 0.5
                            : 1,
                      }}
                    >
                      <Text className='font-sans-semibold text-[13px] text-foreground'>
                        {testingId === a.id ? 'Testing…' : test.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}
      />
      <AutomationBuilder
        visible={builderVisible}
        onClose={() => setBuilderVisible(false)}
        getToken={getToken}
        onCreated={async () => {
          setBuilderVisible(false);
          await refresh();
        }}
      />
    </>
  );
}

function AutomationBuilder({
  visible,
  onClose,
  getToken,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  getToken: () => Promise<string | null>;
  onCreated: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [trigger, setTrigger] = useState<BuilderTrigger>('schedule');
  const [action, setAction] = useState<BuilderAction>('notify_chat');
  const [name, setName] = useState('');
  const [time, setTime] = useState('08:30');
  const [weekday, setWeekday] = useState('1');
  const [currency, setCurrency] = useState('USD');
  const [threshold, setThreshold] = useState('10000');
  const [message, setMessage] = useState('Your Finora financial briefing is ready.');
  const [amount, setAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    const triggerSummary =
      trigger === 'schedule'
        ? `Every week on day ${weekday} at ${time} (Africa/Accra)`
        : `When the ${currency} balance is below ${currency} ${threshold}`;
    const actionSummary =
      action === 'notify_chat'
        ? 'post a notification in chat'
        : action === 'prepare_payment'
          ? `prepare a ${currency} payment${amount ? ` of ${amount}` : ''} for approval`
          : `prepare a ${currency} to GHS conversion for approval`;
    return `${triggerSummary}, Finora will ${actionSummary}.`;
  }, [action, amount, currency, threshold, time, trigger, weekday]);

  const reset = () => {
    setStep(1);
    setTrigger('schedule');
    setAction('notify_chat');
    setName('');
    setTime('08:30');
    setWeekday('1');
    setCurrency('USD');
    setThreshold('10000');
    setMessage('Your Finora financial briefing is ready.');
    setAmount('');
    setRecipientId('');
    setSaving(false);
  };

  const close = () => {
    if (!saving) {
      reset();
      onClose();
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name this automation', 'Give this rule a short name so you can find it later.');
      return;
    }
    if (action === 'prepare_payment' && (!recipientId.trim() || !amount || Number(amount) <= 0)) {
      Alert.alert('Payment details needed', 'Add a recipient ID and a positive amount.');
      return;
    }
    const input: CreateAutomationInput = {
      name: name.trim(),
      trigger:
        trigger === 'schedule'
          ? {
              type: 'schedule',
              config: {
                frequency: 'weekly',
                time,
                timezone: 'Africa/Accra',
                weekday: Number(weekday),
              },
            }
          : {
              type: 'balance_threshold',
              config: {
                currency: currency as CreateAutomationInput['trigger']['config'] extends {
                  currency: infer C;
                }
                  ? C
                  : never,
                operator: 'below',
                amount: Number(threshold),
              },
            },
      conditions: [],
      action:
        action === 'notify_chat'
          ? { type: 'notify_chat', config: { message } }
          : action === 'prepare_payment'
            ? {
                type: 'prepare_payment',
                config: {
                  recipientId: recipientId.trim(),
                  amount: Number(amount),
                  currency: currency as never,
                },
              }
            : {
                type: 'prepare_conversion',
                config: {
                  fromCurrency: currency as never,
                  toCurrency: 'GHS',
                  amount: Number(amount) > 0 ? Number(amount) : undefined,
                  amountMode: 'fixed',
                },
              },
      status: 'active',
      cooldownSeconds: trigger === 'balance_threshold' ? 21600 : 0,
    };
    setSaving(true);
    try {
      await createRemoteAutomation(getToken, input);
      await onCreated();
      reset();
    } catch (error) {
      setSaving(false);
      Alert.alert(
        'Could not create automation',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  return (
    <SheetModal
      visible={visible}
      onClose={close}
      keyboardAvoiding
      style={{ maxHeight: '92%' }}
    >
      <ScrollView
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 36 }}
      >
        <View className='gap-1'>
          <Text className='font-sans-semibold text-[22px] text-foreground'>Create automation</Text>
          <Text className='font-sans text-[14px] leading-5 text-muted-foreground'>
            Finora prepares actions for your approval. It never moves money automatically.
          </Text>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder='Automation name'
          placeholderTextColor={colors.mutedForeground}
          style={[inputStyle, { color: colors.foreground, borderColor: colors.border }]}
        />
        {step === 1 ? (
          <>
            <Text className='font-sans-semibold text-[14px] text-foreground'>
              When should it run?
            </Text>
            <Choice
              label='On a schedule'
              selected={trigger === 'schedule'}
              onPress={() => setTrigger('schedule')}
            />
            <Choice
              label='When a wallet balance changes'
              selected={trigger === 'balance_threshold'}
              onPress={() => setTrigger('balance_threshold')}
            />
            {trigger === 'schedule' ? (
              <View className='gap-2'>
                <Text className='text-[13px] text-muted-foreground'>Weekly schedule</Text>
                <View className='flex-row gap-2'>
                  <TextInput
                    value={weekday}
                    onChangeText={setWeekday}
                    keyboardType='number-pad'
                    style={[
                      inputStyle,
                      { flex: 1, color: colors.foreground, borderColor: colors.border },
                    ]}
                    placeholder='Day 1-5'
                  />
                  <TextInput
                    value={time}
                    onChangeText={setTime}
                    style={[
                      inputStyle,
                      { flex: 1, color: colors.foreground, borderColor: colors.border },
                    ]}
                    placeholder='08:30'
                  />
                </View>
              </View>
            ) : (
              <View className='flex-row gap-2'>
                <TextInput
                  value={currency}
                  onChangeText={(value) => setCurrency(value.toUpperCase())}
                  style={[
                    inputStyle,
                    { flex: 1, color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder='USD'
                  autoCapitalize='characters'
                />
                <TextInput
                  value={threshold}
                  onChangeText={setThreshold}
                  keyboardType='decimal-pad'
                  style={[
                    inputStyle,
                    { flex: 2, color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder='10000'
                />
              </View>
            )}
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Text className='font-sans-semibold text-[14px] text-foreground'>
              What should Finora prepare?
            </Text>
            <Choice
              label='Notify me in chat'
              selected={action === 'notify_chat'}
              onPress={() => setAction('notify_chat')}
            />
            <Choice
              label='Prepare a payment for approval'
              selected={action === 'prepare_payment'}
              onPress={() => setAction('prepare_payment')}
            />
            <Choice
              label='Prepare an FX conversion for approval'
              selected={action === 'prepare_conversion'}
              onPress={() => setAction('prepare_conversion')}
            />
            {action === 'notify_chat' ? (
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                placeholder='Notification message'
                placeholderTextColor={colors.mutedForeground}
                style={[
                  inputStyle,
                  {
                    height: 78,
                    color: colors.foreground,
                    borderColor: colors.border,
                    textAlignVertical: 'top',
                    paddingTop: 12,
                  },
                ]}
              />
            ) : null}
            {action === 'prepare_payment' ? (
              <View className='gap-2'>
                <TextInput
                  value={recipientId}
                  onChangeText={setRecipientId}
                  placeholder='Recipient ID'
                  placeholderTextColor={colors.mutedForeground}
                  style={[inputStyle, { color: colors.foreground, borderColor: colors.border }]}
                />
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType='decimal-pad'
                  placeholder={`Amount in ${currency}`}
                  placeholderTextColor={colors.mutedForeground}
                  style={[inputStyle, { color: colors.foreground, borderColor: colors.border }]}
                />
              </View>
            ) : null}
            {action === 'prepare_conversion' ? (
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType='decimal-pad'
                placeholder={`Amount in ${currency} (optional)`}
                placeholderTextColor={colors.mutedForeground}
                style={[inputStyle, { color: colors.foreground, borderColor: colors.border }]}
              />
            ) : null}
          </>
        ) : null}
        {step === 3 ? (
          <View className='gap-3 rounded-[18px] bg-muted p-4'>
            <Text className='font-sans-semibold text-[14px] text-foreground'>
              Review before activation
            </Text>
            <Text className='font-sans text-[15px] leading-6 text-foreground'>{summary}</Text>
            <Text className='font-sans text-[13px] leading-5 text-muted-foreground'>
              This creates a pending preparation or notification. Any money movement still requires
              approval and biometric sign-off.
            </Text>
          </View>
        ) : null}
        <View className='flex-row gap-2'>
          {step > 1 ? (
            <Pressable
              onPress={() => setStep((value) => (value - 1) as 1 | 2 | 3)}
              className='h-12 flex-1 items-center justify-center rounded-full border border-border'
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>Back</Text>
            </Pressable>
          ) : null}
          {step < 3 ? (
            <Pressable
              onPress={() => setStep((value) => (value + 1) as 1 | 2 | 3)}
              className='h-12 flex-1 items-center justify-center rounded-full bg-primary'
            >
              <Text className='font-sans-semibold text-[15px] text-primary-foreground'>
                Continue
              </Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={saving}
              onPress={() => void save()}
              className='h-12 flex-1 items-center justify-center rounded-full bg-primary'
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              <Text className='font-sans-semibold text-[15px] text-primary-foreground'>
                {saving ? 'Activating…' : 'Confirm & activate'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SheetModal>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className='min-h-12 flex-row items-center justify-between rounded-[16px] border border-border px-4'
    >
      <Text className='font-sans-medium text-[15px] text-foreground'>{label}</Text>
      <View
        className={`h-5 w-5 rounded-full border-2 ${selected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}
      />
    </Pressable>
  );
}
