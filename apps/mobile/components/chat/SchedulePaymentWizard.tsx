import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RecurringFrequency, RecurringPayment } from '@/components/recurring/types';

import { RecurringPaymentCard, type RecurringDraft } from '@/components/chat/RecurringPaymentCard';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export type ScheduleWizardSeed = {
  purpose?: string;
  amount?: number;
  currency?: string;
  recipientName?: string;
  frequency?: RecurringFrequency;
  destinationKind?: RecurringDraft['destination']['kind'];
  destinationLabel?: string;
  destinationValue?: string;
  dayOfMonth?: number;
  timeOfDay?: string;
  reference?: string;
};

type Step = 'purpose' | 'amount' | 'recipient' | 'rail' | 'destination' | 'when' | 'review';

const STEPS: Step[] = ['purpose', 'amount', 'recipient', 'rail', 'destination', 'when', 'review'];

const PURPOSES = ['Rent', 'Salary', 'Supplier', 'Utilities', 'Allowance', 'Other'] as const;
const AMOUNTS = [250, 500, 780, 1500, 4500];
const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR', 'USDT'];
const TIMES = ['08:00', '09:00', '12:00', '17:00', '18:00'];
const DAYS = [
  { label: '1st', value: 1 },
  { label: '5th', value: 5 },
  { label: '15th', value: 15 },
  { label: '25th', value: 25 },
  { label: 'Last day', value: 28 },
];

function computeNextRun(
  frequency: RecurringFrequency,
  dayOfMonth: number,
  timeOfDay: string,
): string {
  const [hh, mm] = timeOfDay.split(':').map((n) => Number(n));
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh || 9, mm || 0, 0, 0);

  if (frequency === 'weekly') {
    // next occurrence of "day of week" approximated from dayOfMonth % 7
    const targetDow = dayOfMonth % 7;
    const delta = (targetDow - now.getDay() + 7) % 7 || 7;
    next.setDate(now.getDate() + delta);
    return next.toISOString();
  }

  next.setDate(Math.min(dayOfMonth, 28));
  if (next.getTime() <= now.getTime()) {
    next.setMonth(next.getMonth() + (frequency === 'quarterly' ? 3 : 1));
    next.setDate(Math.min(dayOfMonth, 28));
  }
  return next.toISOString();
}

function initialStep(seed: ScheduleWizardSeed): Step {
  if (!seed.purpose) return 'purpose';
  if (seed.amount == null) return 'amount';
  if (!seed.recipientName) return 'recipient';
  if (!seed.destinationKind) return 'rail';
  if (!seed.destinationValue) return 'destination';
  if (!seed.frequency || seed.dayOfMonth == null || !seed.timeOfDay) return 'when';
  return 'review';
}

export function SchedulePaymentWizard({
  seed,
  onCreated,
  onCancelled,
}: {
  seed: ScheduleWizardSeed;
  onCreated?: (payment: RecurringPayment) => void;
  onCancelled?: () => void;
}) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(() => initialStep(seed));
  const [purpose, setPurpose] = useState(seed.purpose ?? '');
  const [amount, setAmount] = useState<number | null>(seed.amount ?? null);
  const [currency, setCurrency] = useState(seed.currency ?? 'GHS');
  const [customAmount, setCustomAmount] = useState('');
  const [recipientName, setRecipientName] = useState(seed.recipientName ?? '');
  const [rail, setRail] = useState<RecurringDraft['destination']['kind'] | null>(
    seed.destinationKind ?? null,
  );
  const [destValue, setDestValue] = useState(seed.destinationValue ?? '');
  const [destLabel, setDestLabel] = useState(seed.destinationLabel ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(seed.frequency ?? 'monthly');
  const [dayOfMonth, setDayOfMonth] = useState(seed.dayOfMonth ?? 1);
  const [timeOfDay, setTimeOfDay] = useState(seed.timeOfDay ?? '09:00');

  const stepIndex = STEPS.indexOf(step) + 1;

  const draft: RecurringDraft = useMemo(() => {
    const label =
      destLabel ||
      (rail === 'mobile_money'
        ? 'MTN MoMo'
        : rail === 'crypto_wallet'
          ? 'USDT · TRC-20'
          : 'Bank account');
    return {
      amount: amount ?? 0,
      currency,
      recipientName: recipientName.trim() || purpose || 'Recipient',
      frequency,
      destination: {
        kind: rail ?? 'bank_account',
        label,
        value: destValue.trim() || '—',
      },
      reference: purpose ? `${purpose} · auto-pay` : (seed.reference ?? 'Scheduled payment'),
      nextRunAt: computeNextRun(frequency, dayOfMonth, timeOfDay),
    };
  }, [
    amount,
    currency,
    recipientName,
    purpose,
    frequency,
    rail,
    destLabel,
    destValue,
    dayOfMonth,
    timeOfDay,
    seed.reference,
  ]);

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]!);
  };

  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]!);
  };

  if (step === 'review') {
    return (
      <View style={styles.review}>
        <Pressable
          onPress={goBack}
          style={styles.backLink}
        >
          <Icon
            name='chevron-left'
            size={16}
            color={colors.mutedForeground}
          />
          <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Edit details</Text>
        </Pressable>
        <RecurringPaymentCard
          draft={draft}
          onCreated={onCreated}
          onCancelled={onCancelled}
        />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
      <WizardStepHeader
        step={stepIndex}
        total={STEPS.length}
        title={
          step === 'purpose'
            ? 'What is this for?'
            : step === 'amount'
              ? 'How much should Finora send?'
              : step === 'recipient'
                ? 'Who receives it?'
                : step === 'rail'
                  ? 'How should it arrive?'
                  : step === 'destination'
                    ? 'Where exactly?'
                    : 'When should it auto-pay?'
        }
        subtitle={
          step === 'when'
            ? 'Create once with your passcode — Finora auto-pays on the schedule.'
            : purpose
              ? `Setting up: ${purpose}`
              : 'Answer a few prompts — we’ll schedule the rest.'
        }
      />

      {step === 'purpose' ? (
        <View style={styles.chips}>
          {PURPOSES.map((p) => (
            <WizardChip
              key={p}
              label={p}
              selected={purpose === p}
              onPress={() => {
                setPurpose(p);
                setTimeout(goNext, 120);
              }}
            />
          ))}
        </View>
      ) : null}

      {step === 'amount' ? (
        <View style={styles.block}>
          <View style={styles.chips}>
            {CURRENCIES.map((c) => (
              <WizardChip
                key={c}
                label={c}
                selected={currency === c}
                onPress={() => setCurrency(c)}
                leading={
                  <CurrencyIcon
                    currency={c}
                    size={18}
                  />
                }
              />
            ))}
          </View>
          <View style={styles.chips}>
            {AMOUNTS.map((a) => (
              <WizardChip
                key={a}
                label={`${a.toLocaleString()}`}
                selected={amount === a}
                onPress={() => {
                  setAmount(a);
                  setCustomAmount('');
                  setTimeout(goNext, 120);
                }}
              />
            ))}
          </View>
          <TextInput
            value={customAmount}
            onChangeText={setCustomAmount}
            keyboardType='decimal-pad'
            placeholder='Or type amount'
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
          <NavRow
            colors={colors}
            onBack={goBack}
            onNext={() => {
              const n = Number(customAmount);
              if (Number.isFinite(n) && n > 0) setAmount(n);
              if ((amount != null && amount > 0) || (Number.isFinite(n) && n > 0)) goNext();
            }}
            nextLabel='Continue'
          />
        </View>
      ) : null}

      {step === 'recipient' ? (
        <View style={styles.block}>
          <View style={styles.chips}>
            {['Landlord', 'Office Rent GH', 'TechFlow Ltd', 'Ama Serwah'].map((name) => (
              <WizardChip
                key={name}
                label={name}
                selected={recipientName === name}
                onPress={() => {
                  setRecipientName(name);
                  setTimeout(goNext, 120);
                }}
              />
            ))}
          </View>
          <TextInput
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder='Type a name'
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
          <NavRow
            colors={colors}
            onBack={goBack}
            onNext={() => {
              if (recipientName.trim()) goNext();
            }}
            nextLabel='Continue'
          />
        </View>
      ) : null}

      {step === 'rail' ? (
        <View style={styles.block}>
          {(
            [
              { kind: 'mobile_money' as const, label: 'Mobile money', hint: 'MTN / Telecel' },
              { kind: 'bank_account' as const, label: 'Bank account', hint: 'ACH / SEPA / FPS' },
              { kind: 'crypto_wallet' as const, label: 'Crypto wallet', hint: 'USDT / USDC' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.kind}
              onPress={() => {
                haptics.selection();
                setRail(opt.kind);
                setDestLabel(
                  opt.kind === 'mobile_money'
                    ? 'MTN MoMo'
                    : opt.kind === 'crypto_wallet'
                      ? 'USDT · TRC-20'
                      : 'Bank account',
                );
                setTimeout(goNext, 120);
              }}
              style={[
                styles.railRow,
                {
                  borderColor: rail === opt.kind ? colors.foreground : colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <Icon
                name={
                  opt.kind === 'mobile_money'
                    ? 'phone'
                    : opt.kind === 'crypto_wallet'
                      ? 'wallet'
                      : 'bank'
                }
                size={18}
                color={colors.foreground}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.railTitle, { color: colors.foreground }]}>{opt.label}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{opt.hint}</Text>
              </View>
            </Pressable>
          ))}
          <NavRow
            colors={colors}
            onBack={goBack}
            onNext={() => {
              if (rail) goNext();
            }}
            nextLabel='Continue'
          />
        </View>
      ) : null}

      {step === 'destination' ? (
        <View style={styles.block}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {rail === 'mobile_money'
              ? 'MoMo number the landlord gets paid on'
              : rail === 'crypto_wallet'
                ? 'Wallet address (TRC-20 for USDT)'
                : 'Account number or IBAN'}
          </Text>
          <View style={styles.chips}>
            {rail === 'mobile_money' ? (
              <>
                <WizardChip
                  label='024 900 1100'
                  onPress={() => {
                    setDestValue('024 900 1100');
                    setDestLabel('MTN MoMo');
                    setTimeout(goNext, 120);
                  }}
                />
                <WizardChip
                  label='055 012 3456'
                  onPress={() => {
                    setDestValue('055 012 3456');
                    setDestLabel('MTN MoMo');
                    setTimeout(goNext, 120);
                  }}
                />
              </>
            ) : rail === 'crypto_wallet' ? (
              <WizardChip
                label='Use demo USDT address'
                onPress={() => {
                  setDestValue('TXyzFinoraLandlordRent9hQ2');
                  setDestLabel('USDT · TRC-20');
                  setTimeout(goNext, 120);
                }}
              />
            ) : (
              <>
                <WizardChip
                  label='•••• 0194'
                  onPress={() => {
                    setDestValue('•••• 0194');
                    setDestLabel('FPS');
                    setTimeout(goNext, 120);
                  }}
                />
                <WizardChip
                  label='GB82 CLRB…'
                  onPress={() => {
                    setDestValue('GB82 CLRB 0406 6800 0194 22');
                    setDestLabel('Bank account');
                    setTimeout(goNext, 120);
                  }}
                />
              </>
            )}
          </View>
          <TextInput
            value={destValue}
            onChangeText={setDestValue}
            placeholder='Or paste / type destination'
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize='none'
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          />
          <NavRow
            colors={colors}
            onBack={goBack}
            onNext={() => {
              if (destValue.trim()) goNext();
            }}
            nextLabel='Continue'
          />
        </View>
      ) : null}

      {step === 'when' ? (
        <View style={styles.block}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Cadence</Text>
          <View style={styles.chips}>
            {(
              [
                ['weekly', 'Weekly'],
                ['monthly', 'Monthly'],
                ['quarterly', 'Quarterly'],
              ] as const
            ).map(([id, label]) => (
              <WizardChip
                key={id}
                label={label}
                selected={frequency === id}
                onPress={() => setFrequency(id)}
              />
            ))}
          </View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {frequency === 'weekly' ? 'Day of week' : 'Day of month'}
          </Text>
          <View style={styles.chips}>
            {DAYS.map((d) => (
              <WizardChip
                key={d.value}
                label={
                  frequency === 'weekly'
                    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'][d.value % 5]!
                    : d.label
                }
                selected={dayOfMonth === d.value}
                onPress={() => setDayOfMonth(d.value)}
              />
            ))}
          </View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Time</Text>
          <View style={styles.chips}>
            {TIMES.map((t) => (
              <WizardChip
                key={t}
                label={t}
                selected={timeOfDay === t}
                onPress={() => setTimeOfDay(t)}
              />
            ))}
          </View>
          <View
            style={[
              styles.preview,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Icon
              name='check'
              size={14}
              color={colors.foreground}
            />
            <Text style={[styles.previewText, { color: colors.foreground }]}>
              Auto-pays {frequency} at {timeOfDay} · next{' '}
              {new Date(computeNextRun(frequency, dayOfMonth, timeOfDay)).toLocaleString(
                undefined,
                { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
              )}
            </Text>
          </View>
          <NavRow
            colors={colors}
            onBack={goBack}
            onNext={goNext}
            nextLabel='Review schedule'
          />
        </View>
      ) : null}
    </View>
  );
}

function NavRow({
  colors,
  onBack,
  onNext,
  nextLabel,
}: {
  colors: { foreground: string; background: string; border: string; mutedForeground: string };
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <View style={styles.nav}>
      <Pressable
        onPress={() => {
          haptics.selection();
          onBack();
        }}
        style={[styles.navBtn, styles.navGhost, { borderColor: colors.border }]}
      >
        <Text style={{ color: colors.foreground, fontWeight: '600' }}>Back</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          haptics.selection();
          onNext();
        }}
        style={[styles.navBtn, { backgroundColor: colors.foreground }]}
      >
        <Text style={{ color: colors.background, fontWeight: '600' }}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
    marginVertical: 8,
  },
  block: {
    gap: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
  },
  railTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewText: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  nav: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  navBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGhost: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  review: {
    gap: 4,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 4,
  },
});
