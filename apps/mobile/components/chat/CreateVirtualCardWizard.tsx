import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  formatCardAmount,
  type CreateVirtualCardInput,
  type VirtualCard,
} from '@/components/cards/types';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { createVirtualCard } from '@/lib/virtual-cards-storage';

export type CreateVirtualCardSeed = {
  label?: string;
  spendLimit?: number;
};

type Step = 'label' | 'limit' | 'review' | 'issued';

const LABEL_CHIPS = ['Netflix', 'Meta ads', 'General', 'AWS', 'Travel'];
const LIMIT_CHIPS = [25, 50, 100, 300];

function initialStep(seed: CreateVirtualCardSeed): Step {
  if (!seed.label) return 'label';
  if (seed.spendLimit == null) return 'limit';
  return 'review';
}

export function CreateVirtualCardWizard({
  seed,
  onCancelled,
  onIssued,
}: {
  seed: CreateVirtualCardSeed;
  onCancelled?: () => void;
  onIssued?: (card: VirtualCard) => void;
}) {
  const { colors } = useTheme();
  const { requestApproval, modal } = usePasscodeApproval();
  const [step, setStep] = useState<Step>(() => initialStep(seed));
  const [label, setLabel] = useState(seed.label ?? '');
  const [customLabel, setCustomLabel] = useState('');
  const [spendLimit, setSpendLimit] = useState<number | null>(seed.spendLimit ?? null);
  const [customLimit, setCustomLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<VirtualCard | null>(null);

  const stepIndex = useMemo(() => {
    const order: Step[] = ['label', 'limit', 'review', 'issued'];
    return order.indexOf(step) + 1;
  }, [step]);

  const resolvedLabel = label || customLabel.trim();
  const resolvedLimit =
    spendLimit ?? (customLimit.trim() ? Number(customLimit.replace(/,/g, '')) : null);

  const issue = async () => {
    if (!resolvedLabel || !resolvedLimit || resolvedLimit <= 0 || busy) return;
    setBusy(true);
    const ok = await requestApproval();
    if (!ok) {
      setBusy(false);
      return;
    }
    const input: CreateVirtualCardInput = {
      label: resolvedLabel,
      spendLimit: resolvedLimit,
    };
    const card = await createVirtualCard(input);
    setIssued(card);
    setStep('issued');
    setBusy(false);
    haptics.success();
    onIssued?.(card);
  };

  return (
    <View
      className={
        step === 'issued' ? 'my-2.5 w-full' : 'my-2 gap-3 border border-border bg-composer p-3.5'
      }
      style={step === 'issued' ? undefined : styles.shell}
    >
      {step !== 'issued' ? (
        <WizardStepHeader
          step={Math.min(stepIndex, 3)}
          total={3}
          title={
            step === 'label'
              ? 'What is this card for?'
              : step === 'limit'
                ? 'Monthly spend limit'
                : 'Review & issue'
          }
          subtitle={
            step === 'review'
              ? 'USD card · confirm with your passcode to issue.'
              : step === 'limit'
                ? 'Virtual cards are issued in USD.'
                : undefined
          }
        />
      ) : null}

      {step === 'label' ? (
        <View className='gap-3'>
          <View className='flex-row flex-wrap gap-2'>
            {LABEL_CHIPS.map((chip) => (
              <WizardChip
                key={chip}
                label={chip}
                selected={label === chip}
                onPress={() => {
                  setLabel(chip);
                  setCustomLabel('');
                  setStep('limit');
                }}
              />
            ))}
          </View>
          <TextInput
            value={customLabel}
            onChangeText={(t) => {
              setCustomLabel(t);
              setLabel('');
            }}
            placeholder='Custom label'
            placeholderTextColor={colors.mutedForeground}
            className='font-sans text-[16px] border px-3 py-3 text-foreground border-border'
            style={[styles.input]}
          />
          <PrimaryButton
            label='Continue'
            disabled={!resolvedLabel}
            onPress={() => setStep('limit')}
          />
        </View>
      ) : null}

      {step === 'limit' ? (
        <View className='gap-3'>
          <View className='flex-row flex-wrap gap-2'>
            {LIMIT_CHIPS.map((n) => (
              <WizardChip
                key={n}
                label={formatCardAmount(n, 'USD')}
                selected={spendLimit === n}
                onPress={() => {
                  setSpendLimit(n);
                  setCustomLimit('');
                  setStep('review');
                }}
              />
            ))}
          </View>
          <TextInput
            value={customLimit}
            onChangeText={(t) => {
              setCustomLimit(t.replace(/[^0-9.]/g, ''));
              setSpendLimit(null);
            }}
            keyboardType='decimal-pad'
            placeholder='Custom USD limit'
            placeholderTextColor={colors.mutedForeground}
            className='font-sans text-[16px] border px-3 py-3 text-foreground border-border'
            style={[styles.input]}
          />
          <View className='flex-row gap-2'>
            <SecondaryButton
              label='Back'
              onPress={() => setStep('label')}
            />
            <PrimaryButton
              label='Continue'
              disabled={!resolvedLimit || resolvedLimit <= 0}
              onPress={() => setStep('review')}
            />
          </View>
        </View>
      ) : null}

      {step === 'review' && resolvedLimit ? (
        <View className='gap-3'>
          <View
            className='border p-3 gap-2.5 border-border'
            style={[styles.review]}
          >
            <Row
              label='Label'
              value={resolvedLabel}
            />
            <Row
              label='Currency'
              value='USD'
            />
            <Row
              label='Limit'
              value={formatCardAmount(resolvedLimit, 'USD')}
            />
          </View>
          <View className='flex-row gap-2'>
            <SecondaryButton
              label='Back'
              onPress={() => setStep('limit')}
            />
            <PrimaryButton
              label={busy ? 'Issuing…' : 'Issue card'}
              disabled={busy}
              onPress={() => void issue()}
            />
          </View>
          {onCancelled ? (
            <Pressable
              onPress={onCancelled}
              className='items-center py-1'
            >
              <Text className='font-sans text-[14px] text-muted-foreground'>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {step === 'issued' && issued ? (
        <View className='w-[100%] gap-3'>
          <View className='w-11 h-11 rounded-[22px] items-center justify-center bg-foreground'>
            <Icon
              name='check'
              size={24}
              color={colors.background}
              weight='bold'
            />
          </View>
          <View className='gap-0.5 px-1'>
            <Text className='font-sans-semibold text-[18px] tracking-[-0.3px] text-foreground'>
              Request confirmed
            </Text>
            <Text className='font-sans text-[14px] leading-[20px] mb-1 text-muted-foreground'>
              We’re issuing your {issued.label} card. You’ll receive its card details as soon as
              they’re ready.
            </Text>
          </View>
        </View>
      ) : null}

      {modal}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className='flex-row justify-between gap-3'>
      <Text className='font-sans text-[14px] text-muted-foreground'>{label}</Text>
      <Text className='font-sans-semibold text-[14px] text-foreground'>{value}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        haptics.selection();
        onPress();
      }}
      className='flex-1 py-3 items-center'
      style={[
        styles.primary,
        {
          backgroundColor: disabled ? colors.muted : colors.primary,
          opacity: disabled ? 0.7 : 1,
        },
      ]}
    >
      <Text
        className='font-sans-semibold text-[15px]'
        style={[{ color: disabled ? colors.mutedForeground : colors.primaryForeground }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className='border py-3 px-4 items-center justify-center border-border'
      style={[styles.secondary]}
    >
      <Text className='font-sans-medium text-[15px] text-foreground'>{label}</Text>
    </Pressable>
  );
}

const styles = {
  shell: {
    borderRadius: Radius.card,
  },
  input: {
    borderRadius: Radius.md,
  },
  primary: {
    borderRadius: Radius.pill,
  },
  secondary: {
    borderRadius: Radius.pill,
  },
  review: {
    borderRadius: Radius.md,
  },
} as const;
