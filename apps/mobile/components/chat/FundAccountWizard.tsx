import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FUNDING_SOURCE_COPY,
  methodsForSource,
  pickMethod,
  type FundingMethod,
  type FundingSource,
} from '@/lib/funding-methods';
import { haptics } from '@/lib/haptics';
import { playPaymentSuccessSound } from '@/lib/sounds';

export type FundAccountSeed = {
  source?: FundingSource;
  currency?: string;
  amount?: number;
  methodId?: string;
};

type Step = 'source' | 'method' | 'details' | 'momo_pull' | 'waiting' | 'credited';

const PULL_AMOUNTS = [20, 50, 100, 200, 500];

function initialStep(seed: FundAccountSeed): Step {
  if (!seed.source) return 'source';
  if (seed.source === 'momo_pull') return 'momo_pull';
  const pool = methodsForSource(seed.source);
  if (
    (seed.source === 'bank' || seed.source === 'crypto') &&
    pool.length > 1 &&
    !seed.methodId &&
    !seed.currency
  ) {
    return 'method';
  }
  return 'details';
}

export function FundAccountWizard({
  seed,
  onCancelled,
  onCredited,
}: {
  seed: FundAccountSeed;
  onCancelled?: () => void;
  onCredited?: (payload: {
    amount: number;
    currency: string;
    source: FundingSource;
    method: FundingMethod;
    transactionId: string;
  }) => void;
}) {
  const { colors, isDark } = useTheme();
  const [step, setStep] = useState<Step>(() => initialStep(seed));
  const [source, setSource] = useState<FundingSource | null>(seed.source ?? null);
  const [method, setMethod] = useState<FundingMethod | null>(
    () =>
      pickMethod({
        source: seed.source === 'momo_pull' ? 'mobile_money' : seed.source,
        currency: seed.currency,
        methodId: seed.methodId,
      }) ?? null,
  );
  const [amount, setAmount] = useState<number | null>(seed.amount ?? null);
  const [customAmount, setCustomAmount] = useState('');
  const [phone, setPhone] = useState('0550123456');
  const [network, setNetwork] = useState('MTN');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState<number | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const creditedRef = useRef(false);
  const onCreditedRef = useRef(onCredited);
  onCreditedRef.current = onCredited;

  const bankMethods = useMemo(() => methodsForSource('bank'), []);
  const allSources: FundingSource[] = ['bank', 'mobile_money', 'momo_pull', 'crypto'];

  useEffect(() => {
    if (step !== 'waiting') return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 2200));
      if (cancelled || creditedRef.current) return;
      const credited =
        amount ??
        (source === 'crypto'
          ? 50
          : source === 'mobile_money' || source === 'momo_pull'
            ? 100
            : 250);
      const tx = `WW-IN-${Math.floor(Math.random() * 1e8)
        .toString(16)
        .padStart(8, '0')
        .toUpperCase()}`;
      creditedRef.current = true;
      setCreditAmount(credited);
      setTransactionId(tx);
      setStep('credited');
      haptics.success();
      void playPaymentSuccessSound();
      if (method) {
        onCreditedRef.current?.({
          amount: credited,
          currency: method.currency,
          source: source ?? 'bank',
          method,
          transactionId: tx,
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [amount, method, source, step]);

  const copyValue = async (value: string, key: string) => {
    haptics.selection();
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    haptics.success();
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
  };

  const shareMethod = async (m: FundingMethod) => {
    haptics.selection();
    const message = [
      `Finora · Add ${m.currency}`,
      m.title,
      ...m.fields.map((f) => `${f.label}: ${f.value}`),
    ].join('\n');
    try {
      await Share.share({ message, title: `Fund ${m.currency} · Finora` });
    } catch {
      // ignored
    }
  };

  const stepMeta = (() => {
    const multiMethod =
      (source === 'bank' || source === 'crypto') &&
      methodsForSource(source).length > 1 &&
      !seed.currency &&
      !seed.methodId;
    const order: Step[] =
      source === 'momo_pull'
        ? ['source', 'momo_pull', 'waiting', 'credited']
        : multiMethod
          ? ['source', 'method', 'details', 'waiting', 'credited']
          : ['source', 'details', 'waiting', 'credited'];
    const idx = Math.max(1, order.indexOf(step) + 1);
    return { step: Math.min(idx, order.length), total: order.length };
  })();

  return (
    <View
      className='my-2 border p-3.5 gap-3 max-w-[420px] self-stretch bg-composer border-border'
      style={[styles.card]}
    >
      {step === 'source' ? (
        <View className='gap-3'>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title='Add money'
            subtitle='Pick how funds should reach your Finora wallet'
          />
          <View className='gap-2'>
            {allSources.map((s) => {
              const copy = FUNDING_SOURCE_COPY[s];
              const icon = s === 'bank' ? 'bank' : s === 'crypto' ? 'wallet' : 'phone';
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    haptics.selection();
                    setSource(s);
                    if (s === 'momo_pull') {
                      const m = pickMethod({ source: 'mobile_money', currency: 'GHS' });
                      setMethod(m ?? null);
                      setStep('momo_pull');
                      return;
                    }
                    const pool = methodsForSource(s);
                    const preferred =
                      pickMethod({
                        source: s,
                        currency: seed.currency,
                        methodId: seed.methodId,
                      }) ?? pool[0]!;
                    setMethod(preferred);
                    if (
                      (s === 'bank' || s === 'crypto') &&
                      pool.length > 1 &&
                      !seed.currency &&
                      !seed.methodId
                    ) {
                      setStep('method');
                    } else {
                      setStep('details');
                    }
                  }}
                  className='flex-row items-center gap-3 p-3 border'
                  style={({ pressed }) => [
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View className='w-9 h-9 rounded-[18px] items-center justify-center bg-muted'>
                    <Icon
                      name={icon}
                      size={16}
                      color={colors.foreground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className='text-[16px] font-semibold text-foreground'>{copy.label}</Text>
                    <Text className='text-[13px] font-medium mt-0.5 leading-[16px] text-muted-foreground'>
                      {copy.blurb}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onCancelled}>
            <Text className='text-center font-semibold text-[15px] text-muted-foreground'>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'method' && (source === 'bank' || source === 'crypto') ? (
        <View className='gap-3'>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title={source === 'crypto' ? 'Which stablecoin?' : 'Which currency?'}
            subtitle={
              source === 'crypto'
                ? 'Pick USDT or USDC — network must match when you send'
                : 'Each virtual account credits its matching wallet'
            }
          />
          <View className='flex-row flex-wrap gap-2'>
            {(source === 'crypto' ? methodsForSource('crypto') : bankMethods).map((m) => (
              <WizardChip
                key={m.id}
                label={m.currency}
                selected={method?.id === m.id}
                onPress={() => {
                  setMethod(m);
                  setStep('details');
                }}
                leading={
                  <CurrencyIcon
                    currency={m.currency}
                    size={18}
                  />
                }
              />
            ))}
          </View>
          <NavBack
            colors={colors}
            onBack={() => setStep('source')}
          />
        </View>
      ) : null}

      {step === 'details' && method ? (
        <View className='gap-3'>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title={method.title}
            subtitle={method.subtitle}
          />
          <View
            className='self-center p-2.5'
            style={[styles.qrWrap, { backgroundColor: isDark ? '#fff' : colors.background }]}
          >
            <MockQrCode
              value={method.qrPayload}
              size={140}
              color='#18181b'
              backgroundColor='#ffffff'
              centerLogo={
                <CurrencyIcon
                  currency={method.currency}
                  size={32}
                />
              }
            />
          </View>
          <View className='gap-2'>
            {method.fields.map((field) => {
              const key = field.label;
              const copied = copiedKey === key;
              return (
                <View
                  key={key}
                  className='flex-row items-center gap-2.5 border px-3 py-2.5 border-border'
                  style={[styles.field]}
                >
                  <View style={{ flex: 1 }}>
                    <Text className='text-[12px] font-semibold mb-0.5 text-muted-foreground'>
                      {field.label}
                    </Text>
                    <Text
                      selectable
                      className='text-[15px] font-medium text-foreground'
                    >
                      {field.value}
                    </Text>
                  </View>
                  {field.copyable !== false ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => void copyValue(field.value, key)}
                      className='w-[34px] h-[34px] rounded-[17px] items-center justify-center bg-muted'
                    >
                      <Icon
                        name={copied ? 'check' : 'copy'}
                        size={15}
                        color={colors.foreground}
                      />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
          <Text className='text-[13px] font-medium leading-[17px] text-muted-foreground'>
            Send from your {source === 'crypto' ? 'wallet' : 'bank or app'} using these details.
            We’ll credit you when it lands.
          </Text>
          <View className='flex-row gap-2.5'>
            <Pressable
              onPress={() => void shareMethod(method)}
              className='flex-1 min-h-[46px] border items-center justify-center'
              style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Text className='text-[16px] font-semibold text-foreground'>Share</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.selection();
                setAmount(null);
                setStep('waiting');
              }}
              className='flex-[1.4] min-h-[46px] items-center justify-center'
              style={({ pressed }) => [
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text
                style={{ color: colors.primaryForeground }}
                className='text-[16px] font-semibold'
              >
                I’ve sent it
              </Text>
            </Pressable>
          </View>
          <NavBack
            colors={colors}
            onBack={() =>
              setStep(
                (source === 'bank' || source === 'crypto') && !seed.currency && !seed.methodId
                  ? 'method'
                  : 'source',
              )
            }
          />
        </View>
      ) : null}

      {step === 'momo_pull' ? (
        <View className='gap-3'>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title='Charge mobile money'
            subtitle='We’ll send a prompt to your phone — approve to fund GHS'
          />
          <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase text-muted-foreground'>
            Network
          </Text>
          <View className='flex-row flex-wrap gap-2'>
            {['MTN', 'VODAFONE', 'TELECEL'].map((n) => (
              <WizardChip
                key={n}
                label={n}
                selected={network === n}
                onPress={() => setNetwork(n)}
              />
            ))}
          </View>
          <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase text-muted-foreground'>
            Phone
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType='phone-pad'
            placeholder='0550123456'
            placeholderTextColor={colors.mutedForeground}
            className='font-sans-medium border px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
            style={[styles.input]}
          />
          <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase text-muted-foreground'>
            Amount (GHS)
          </Text>
          <View className='flex-row flex-wrap gap-2'>
            {PULL_AMOUNTS.map((n) => (
              <WizardChip
                key={n}
                label={`${n}`}
                selected={amount === n}
                onPress={() => {
                  setAmount(n);
                  setCustomAmount('');
                }}
              />
            ))}
          </View>
          <TextInput
            value={customAmount}
            onChangeText={(t) => {
              setCustomAmount(t);
              setAmount(null);
            }}
            keyboardType='decimal-pad'
            placeholder='Custom amount'
            placeholderTextColor={colors.mutedForeground}
            className='font-sans-medium border px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
            style={[styles.input]}
          />
          <View className='flex-row gap-2.5'>
            <Pressable
              onPress={() => setStep('source')}
              className='flex-1 min-h-[46px] border items-center justify-center'
              style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            >
              <Text className='text-[16px] font-semibold text-foreground'>Back</Text>
            </Pressable>
            <Pressable
              disabled={
                !(amount ?? (Number(customAmount) > 0 ? Number(customAmount) : null)) ||
                phone.trim().length < 9
              }
              onPress={() => {
                const n = amount ?? Number(customAmount);
                if (!Number.isFinite(n) || n <= 0) return;
                haptics.selection();
                setAmount(n);
                if (!method) {
                  setMethod(pickMethod({ source: 'mobile_money', currency: 'GHS' }) ?? null);
                }
                setStep('waiting');
              }}
              className='flex-[1.4] min-h-[46px] items-center justify-center'
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity:
                    !(amount ?? (Number(customAmount) > 0 ? Number(customAmount) : null)) ||
                    phone.trim().length < 9
                      ? 0.4
                      : pressed
                        ? 0.85
                        : 1,
                },
              ]}
            >
              <Text
                style={{ color: colors.primaryForeground }}
                className='text-[16px] font-semibold'
              >
                Send prompt
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 'waiting' ? (
        <View className='gap-3'>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title={source === 'momo_pull' ? 'Approve on your phone' : 'Waiting for funds'}
            subtitle={
              source === 'momo_pull'
                ? `Check ${network} on ${phone} and approve the charge`
                : `Watching ${method?.currency ?? ''} · usually lands in seconds to a day`
            }
          />
          <View className='items-center gap-3 py-6'>
            <LoadingIcon color={colors.foreground} />
            <Text className='text-[14px] font-medium text-muted-foreground'>
              {source === 'momo_pull' ? 'Collection pending…' : 'Listening for an inbound credit…'}
            </Text>
          </View>
        </View>
      ) : null}

      {step === 'credited' && method && creditAmount != null ? (
        <View className='gap-3'>
          <View className='w-12 h-12 rounded-[24px] items-center justify-center self-center bg-muted'>
            <Icon
              name='check'
              size={22}
              color={colors.foreground}
            />
          </View>
          <Text className='font-sans-semibold text-center text-[14px] tracking-[0.2px] uppercase text-foreground'>
            Funds received
          </Text>
          <Text className='font-sans-semibold text-center text-[29px] tracking-[-0.5px] text-foreground'>
            {formatPaymentAmount(creditAmount, method.currency)}
          </Text>
          <Text className='text-[13px] font-medium leading-[17px] text-muted-foreground'>
            Added to your {method.currency} wallet
            {transactionId ? ` · ${transactionId}` : ''}
          </Text>
          <Text className='text-[13px] font-medium leading-[17px] text-muted-foreground'>
            You can send, convert, or hold it — say “send …” when you’re ready.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function NavBack({
  colors,
  onBack,
}: {
  colors: { border: string; foreground: string };
  onBack: () => void;
}) {
  return (
    <Pressable
      onPress={onBack}
      className='min-h-10 border items-center justify-center'
      style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
    >
      <Text className='font-semibold text-[15px] text-foreground'>Back</Text>
    </Pressable>
  );
}

const styles = {
  card: {
    borderRadius: Radius.lg,
  },
  sourceRow: {
    borderRadius: Radius.composer,
  },
  qrWrap: {
    borderRadius: Radius.lg,
  },
  field: {
    borderRadius: Radius.composer,
  },
  primaryBtn: {
    borderRadius: Radius.composer,
  },
  secondaryBtn: {
    borderRadius: Radius.composer,
  },
  input: {
    borderRadius: Radius.composer,
  },
  backOnly: {
    borderRadius: Radius.composer,
  },
};
