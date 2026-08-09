import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
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
    <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
      {step === 'source' ? (
        <View style={styles.block}>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title='Add money'
            subtitle='Pick how funds should reach your Finora wallet'
          />
          <View style={styles.sourceList}>
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
                  style={({ pressed }) => [
                    styles.sourceRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.sourceIcon, { backgroundColor: colors.muted }]}>
                    <Icon
                      name={icon}
                      size={16}
                      color={colors.foreground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sourceTitle, { color: colors.foreground }]}>
                      {copy.label}
                    </Text>
                    <Text style={[styles.sourceBlurb, { color: colors.mutedForeground }]}>
                      {copy.blurb}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onCancelled}>
            <Text style={[styles.cancel, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'method' && (source === 'bank' || source === 'crypto') ? (
        <View style={styles.block}>
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
          <View style={styles.chips}>
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
        <View style={styles.block}>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title={method.title}
            subtitle={method.subtitle}
          />
          <View style={[styles.qrWrap, { backgroundColor: isDark ? '#fff' : colors.background }]}>
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
          <View style={styles.fields}>
            {method.fields.map((field) => {
              const key = field.label;
              const copied = copiedKey === key;
              return (
                <View
                  key={key}
                  style={[styles.field, { borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      {field.label}
                    </Text>
                    <Text
                      selectable
                      style={[styles.fieldValue, { color: colors.foreground }]}
                    >
                      {field.value}
                    </Text>
                  </View>
                  {field.copyable !== false ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => void copyValue(field.value, key)}
                      style={[styles.copyBtn, { backgroundColor: colors.muted }]}
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
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Send from your {source === 'crypto' ? 'wallet' : 'bank or app'} using these details.
            We’ll credit you when it lands.
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => void shareMethod(method)}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>Share</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.selection();
                setAmount(null);
                setStep('waiting');
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.primaryLabel, { color: colors.background }]}>I’ve sent it</Text>
            </Pressable>
          </View>
          <NavBack
            colors={colors}
            onBack={() =>
              setStep(
                (source === 'bank' || source === 'crypto') &&
                  !seed.currency &&
                  !seed.methodId
                  ? 'method'
                  : 'source',
              )
            }
          />
        </View>
      ) : null}

      {step === 'momo_pull' ? (
        <View style={styles.block}>
          <WizardStepHeader
            step={stepMeta.step}
            total={stepMeta.total}
            title='Charge mobile money'
            subtitle='We’ll send a prompt to your phone — approve to fund GHS'
          />
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Network</Text>
          <View style={styles.chips}>
            {['MTN', 'VODAFONE', 'TELECEL'].map((n) => (
              <WizardChip
                key={n}
                label={n}
                selected={network === n}
                onPress={() => setNetwork(n)}
              />
            ))}
          </View>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType='phone-pad'
            placeholder='0550123456'
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          />
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Amount (GHS)</Text>
          <View style={styles.chips}>
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
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          />
          <View style={styles.actions}>
            <Pressable
              onPress={() => setStep('source')}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>Back</Text>
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
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.foreground,
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
              <Text style={[styles.primaryLabel, { color: colors.background }]}>Send prompt</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 'waiting' ? (
        <View style={styles.block}>
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
          <View style={styles.waitingBox}>
            <ActivityIndicator color={colors.foreground} />
            <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>
              {source === 'momo_pull' ? 'Collection pending…' : 'Listening for an inbound credit…'}
            </Text>
          </View>
        </View>
      ) : null}

      {step === 'credited' && method && creditAmount != null ? (
        <View style={styles.block}>
          <View style={[styles.successIcon, { backgroundColor: colors.muted }]}>
            <Icon
              name='check'
              size={22}
              color={colors.foreground}
            />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Funds received</Text>
          <Text style={[styles.successAmount, { color: colors.foreground }]}>
            {formatPaymentAmount(creditAmount, method.currency)}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Added to your {method.currency} wallet
            {transactionId ? ` · ${transactionId}` : ''}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
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
      style={({ pressed }) => [
        styles.backOnly,
        { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 15 }}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 12,
    maxWidth: 420,
    alignSelf: 'stretch',
  },
  block: { gap: 12 },
  sourceList: { gap: 8 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: { fontSize: 16, fontWeight: '600' },
  sourceBlurb: { fontSize: 13, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  qrWrap: {
    alignSelf: 'center',
    padding: 10,
    borderRadius: Radius.lg,
  },
  fields: { gap: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  fieldValue: { fontSize: 15, fontWeight: '500' },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 13, fontWeight: '500', lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontSize: 16, fontWeight: '600' },
  secondaryLabel: { fontSize: 16, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
  },
  waitingBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  waitingText: { fontSize: 14, fontWeight: '500' },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  successTitle: {
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  successAmount: {
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  cancel: { textAlign: 'center', fontWeight: '600', fontSize: 15 },
  backOnly: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
