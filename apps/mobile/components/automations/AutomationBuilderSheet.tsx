import {
  describeAutomation,
  type AutomationAction,
  type AutomationTrigger,
  type CreateAutomationInput,
  type Currency,
} from '@finora/shared';
import { useAuth } from '@clerk/expo';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { createRemoteAutomation } from '@/lib/automations-api';
import { haptics } from '@/lib/haptics';
import { deviceTimezone } from '@/lib/open-thread';

import { Chips } from './Chips';

type TriggerKind = AutomationTrigger['type'];
type ActionKind = 'notify_chat' | 'prepare_payment' | 'prepare_conversion';
type Frequency = 'daily' | 'weekdays' | 'weekly' | 'monthly';

const CURRENCIES: Currency[] = ['USD', 'GHS', 'NGN', 'KES', 'EUR', 'GBP'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className='gap-2'>
      <Text className='font-sans-semibold text-[14px] text-foreground'>{label}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      className='min-h-[48px] rounded-[18px] border border-border bg-background px-3.5 py-3 font-sans text-[16px] text-foreground'
      style={{ borderCurve: 'continuous' }}
      {...props}
    />
  );
}

/** Builds and turns on an automation. Finora only reminds or prepares; it never pays. */
export function AutomationBuilderSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState('');
  const [triggerKind, setTriggerKind] = useState<TriggerKind>('schedule');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [weekday, setWeekday] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [time, setTime] = useState('09:00');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [operator, setOperator] = useState<'below' | 'above'>('below');
  const [threshold, setThreshold] = useState('1000');
  const [dueWithinDays, setDueWithinDays] = useState('3');
  const [senderDomains, setSenderDomains] = useState('');
  const [actionKind, setActionKind] = useState<ActionKind>('notify_chat');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [toCurrency, setToCurrency] = useState<Currency>('GHS');
  const [saving, setSaving] = useState(false);

  const trigger = useMemo((): AutomationTrigger => {
    if (triggerKind === 'balance_threshold') {
      return {
        type: 'balance_threshold',
        config: { currency, operator, amount: Number(threshold) || 0 },
      };
    }
    if (triggerKind === 'invoice_due') {
      return { type: 'invoice_due', config: { dueWithinDays: Number(dueWithinDays) || 0 } };
    }
    if (triggerKind === 'gmail_invoice') {
      return {
        type: 'gmail_invoice',
        config: {
          senderDomains: senderDomains
            .split(/[\s,]+/)
            .map((domain) => domain.trim().toLowerCase())
            .filter(Boolean),
          requirePdfAttachment: false,
        },
      };
    }
    return {
      type: 'schedule',
      config: {
        frequency,
        time,
        timezone: deviceTimezone(),
        ...(frequency === 'weekly' ? { weekday } : {}),
        ...(frequency === 'monthly' ? { dayOfMonth: Number(dayOfMonth) || 1 } : {}),
      },
    };
  }, [
    currency,
    dayOfMonth,
    dueWithinDays,
    frequency,
    operator,
    senderDomains,
    threshold,
    time,
    triggerKind,
    weekday,
  ]);

  const action = useMemo((): AutomationAction => {
    const value = Number(amount) > 0 ? Number(amount) : undefined;
    if (actionKind === 'prepare_payment') {
      return {
        type: 'prepare_payment',
        config: {
          recipient: recipient.trim() || undefined,
          amount: value,
          currency,
          purpose: purpose.trim() || undefined,
        },
      };
    }
    if (actionKind === 'prepare_conversion') {
      return {
        type: 'prepare_conversion',
        config: { fromCurrency: currency, toCurrency, amount: value, amountMode: 'fixed' },
      };
    }
    return {
      type: 'notify_chat',
      config: { message: message.trim() || 'Time to check on this.' },
    };
  }, [actionKind, amount, currency, message, purpose, recipient, toCurrency]);

  const preview = describeAutomation({ trigger, action });

  const reset = () => {
    setName('');
    setTriggerKind('schedule');
    setFrequency('weekly');
    setWeekday(1);
    setDayOfMonth('1');
    setTime('09:00');
    setActionKind('notify_chat');
    setMessage('');
    setRecipient('');
    setAmount('');
    setPurpose('');
    setSaving(false);
  };

  const problem = (() => {
    if (!name.trim()) return 'Give the automation a name.';
    if (triggerKind === 'schedule' && !TIME_PATTERN.test(time)) return 'Use a time like 09:00.';
    if (triggerKind === 'balance_threshold' && !(Number(threshold) > 0)) {
      return 'Enter the balance to watch for.';
    }
    if (actionKind === 'notify_chat' && !message.trim()) return 'Write the reminder.';
    if (actionKind === 'prepare_payment' && !recipient.trim()) return 'Say who to pay.';
    if (actionKind === 'prepare_conversion' && toCurrency === currency) {
      return 'Pick two different currencies.';
    }
    return null;
  })();

  const save = async () => {
    if (problem) {
      Alert.alert('Almost there', problem);
      return;
    }
    const input: CreateAutomationInput = {
      name: name.trim(),
      trigger,
      conditions: [],
      action,
      status: 'active',
      // Balance alerts would repeat on every change; wait six hours between them.
      cooldownSeconds: triggerKind === 'balance_threshold' ? 21_600 : 0,
    };
    setSaving(true);
    try {
      await createRemoteAutomation(getToken, input);
      haptics.success();
      reset();
      onCreated();
    } catch (error) {
      setSaving(false);
      haptics.error();
      Alert.alert(
        "Couldn't create the automation",
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  return (
    <SheetModal
      visible={visible}
      onClose={() => {
        if (!saving) onClose();
      }}
      keyboardAvoiding
      style={{ maxHeight: '92%' }}
    >
      <ScrollView
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 36 }}
      >
        <View className='gap-1'>
          <Text className='font-sans-semibold text-[22px] text-foreground'>New automation</Text>
          <Text className='font-sans text-[14px] leading-5 text-muted-foreground'>
            Finora reminds you or prepares the action. Money only moves after you approve it.
          </Text>
        </View>

        <Field label='Name'>
          <Input
            value={name}
            onChangeText={setName}
            placeholder='e.g. Friday rent'
            maxLength={120}
          />
        </Field>

        <Field label='When'>
          <Chips
            value={triggerKind}
            onChange={setTriggerKind}
            options={[
              { value: 'schedule', label: 'On a schedule' },
              { value: 'balance_threshold', label: 'Balance changes' },
              { value: 'invoice_due', label: 'Invoice due' },
              { value: 'gmail_invoice', label: 'New Gmail invoice' },
            ]}
          />
        </Field>

        {triggerKind === 'schedule' ? (
          <View className='gap-3'>
            <Chips
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekdays', label: 'Weekdays' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
            {frequency === 'weekly' ? (
              <Chips
                value={String(weekday)}
                onChange={(value) => setWeekday(Number(value))}
                options={WEEKDAYS.map((label, index) => ({ value: String(index), label }))}
              />
            ) : null}
            <View className='flex-row gap-2'>
              {frequency === 'monthly' ? (
                <View className='flex-1'>
                  <Input
                    value={dayOfMonth}
                    onChangeText={(value) => setDayOfMonth(value.replace(/\D/g, '').slice(0, 2))}
                    keyboardType='number-pad'
                    placeholder='Day (1-31)'
                  />
                </View>
              ) : null}
              <View className='flex-1'>
                <Input
                  value={time}
                  onChangeText={setTime}
                  placeholder='09:00'
                  keyboardType='numbers-and-punctuation'
                  maxLength={5}
                />
              </View>
            </View>
          </View>
        ) : null}

        {triggerKind === 'balance_threshold' ? (
          <View className='gap-3'>
            <Chips
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <Chips
              value={operator}
              onChange={setOperator}
              options={[
                { value: 'below', label: 'Drops below' },
                { value: 'above', label: 'Goes above' },
              ]}
            />
            <Input
              value={threshold}
              onChangeText={(value) => setThreshold(value.replace(/[^0-9.]/g, ''))}
              keyboardType='decimal-pad'
              placeholder={`Amount in ${currency}`}
            />
          </View>
        ) : null}

        {triggerKind === 'invoice_due' ? (
          <Input
            value={dueWithinDays}
            onChangeText={(value) => setDueWithinDays(value.replace(/\D/g, '').slice(0, 3))}
            keyboardType='number-pad'
            placeholder='Days before it is due'
          />
        ) : null}

        {triggerKind === 'gmail_invoice' ? (
          <Input
            value={senderDomains}
            onChangeText={setSenderDomains}
            autoCapitalize='none'
            autoCorrect={false}
            placeholder='Only from these senders (optional), e.g. ecg.com.gh'
          />
        ) : null}

        <Field label='Then Finora will'>
          <Chips
            value={actionKind}
            onChange={setActionKind}
            options={[
              { value: 'notify_chat', label: 'Remind me' },
              { value: 'prepare_payment', label: 'Prepare a payment' },
              { value: 'prepare_conversion', label: 'Prepare FX' },
            ]}
          />
        </Field>

        {actionKind === 'notify_chat' ? (
          <Input
            value={message}
            onChangeText={setMessage}
            placeholder='e.g. Review last week’s sales'
            multiline
            maxLength={500}
          />
        ) : null}

        {actionKind === 'prepare_payment' ? (
          <View className='gap-3'>
            <Input
              value={recipient}
              onChangeText={setRecipient}
              placeholder='Who to pay, e.g. Kwame, MTN MoMo 0241234567'
              maxLength={160}
            />
            {triggerKind !== 'balance_threshold' ? (
              <Chips
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map((code) => ({ value: code, label: code }))}
              />
            ) : null}
            <Input
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))}
              keyboardType='decimal-pad'
              placeholder={`Amount in ${currency} (optional for invoices)`}
            />
            <Input
              value={purpose}
              onChangeText={setPurpose}
              placeholder='What for (optional), e.g. rent'
              maxLength={200}
            />
          </View>
        ) : null}

        {actionKind === 'prepare_conversion' ? (
          <View className='gap-3'>
            <Text className='font-sans text-[13px] text-muted-foreground'>From</Text>
            <Chips
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <Text className='font-sans text-[13px] text-muted-foreground'>To</Text>
            <Chips
              value={toCurrency}
              onChange={setToCurrency}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <Input
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))}
              keyboardType='decimal-pad'
              placeholder={`Amount in ${currency} (optional)`}
            />
          </View>
        ) : null}

        <View
          className='gap-1.5 rounded-[18px] bg-muted p-4'
          style={{ borderCurve: 'continuous' }}
        >
          <Text className='font-sans-semibold text-[13px] text-muted-foreground'>Preview</Text>
          <Text className='font-sans text-[15px] leading-[22px] text-foreground'>{preview}</Text>
        </View>

        <Pressable
          accessibilityRole='button'
          disabled={saving}
          onPress={() => void save()}
          className='min-h-[52px] items-center justify-center rounded-full bg-foreground px-4 active:opacity-85 disabled:opacity-60'
        >
          <Text className='font-sans-semibold text-base text-background'>
            {saving ? 'Turning on' : 'Turn on automation'}
          </Text>
        </Pressable>
      </ScrollView>
    </SheetModal>
  );
}
