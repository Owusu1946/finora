import { VIRTUAL_CARD_ISSUE_FEE_USD } from '@finora/shared';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  CardFundingSource,
  CardFundingSummary,
  defaultFundingWalletId,
  useFundingWallets,
} from '@/components/cards/CardFundingSource';
import { formatCardAmount, type VirtualCard } from '@/components/cards/types';
import { IssuedVirtualCard } from '@/components/chat/IssuedVirtualCard';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { canFundCard, cardFundingTotalUsd, fundAndIssueCard } from '@/lib/card-funding';
import { haptics } from '@/lib/haptics';

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
  const wallets = useFundingWallets();
  const [walletId, setWalletId] = useState<string | null>(null);
  const fundingWallet = wallets.find((wallet) => wallet.id === walletId) ?? null;
  const canIssue =
    !!resolvedLimit &&
    resolvedLimit > 0 &&
    fundingWallet !== null &&
    canFundCard(fundingWallet, resolvedLimit);

  // Keep a funding account selected that can cover the card as the amount changes.
  useEffect(() => {
    if (!resolvedLimit || resolvedLimit <= 0) return;
    if (fundingWallet && canFundCard(fundingWallet, resolvedLimit)) return;
    setWalletId(defaultFundingWalletId(wallets, resolvedLimit));
  }, [fundingWallet, resolvedLimit, wallets]);

  const issue = async () => {
    if (!resolvedLabel || !resolvedLimit || !canIssue || !walletId || busy) return;
    setBusy(true);
    const ok = await requestApproval();
    if (!ok) {
      setBusy(false);
      return;
    }
    let card;
    try {
      // The wizard shows the issued card itself; skip the global "Card ready" popup.
      card = await fundAndIssueCard({
        label: resolvedLabel,
        amountUsd: resolvedLimit,
        walletId,
        announce: false,
      });
    } catch (error) {
      setBusy(false);
      haptics.error();
      Alert.alert(
        "Couldn't create card",
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
      return;
    }
    setIssued(card);
    setStep('issued');
    setBusy(false);
    haptics.success();
    onIssued?.(card);
  };

  return (
    <View
      className={
        step === 'issued' ? 'my-2.5 w-full' : 'my-2 gap-4 border border-border bg-composer p-5'
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
              ? 'Confirm with your passcode to issue.'
              : step === 'limit'
                ? 'Cards are issued in USD.'
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
            placeholder='Or type your own label'
            placeholderTextColor={colors.mutedForeground}
            className='font-sans-medium border px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
            style={[styles.input]}
          />
          <View className='flex-row'>
            <PrimaryButton
              label='Continue'
              disabled={!resolvedLabel}
              onPress={() => setStep('limit')}
            />
          </View>
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
            placeholder='Or set your own USD limit'
            placeholderTextColor={colors.mutedForeground}
            className='font-sans-medium border px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
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
            className='border p-4 gap-3 bg-background border-border'
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
              label='Card balance'
              value={formatCardAmount(resolvedLimit, 'USD')}
            />
            <Row
              label='Issue fee'
              value={formatCardAmount(VIRTUAL_CARD_ISSUE_FEE_USD, 'USD')}
            />
            <Row
              label='Total'
              value={formatCardAmount(cardFundingTotalUsd(resolvedLimit), 'USD')}
            />
          </View>
          <View className='gap-2'>
            <Text className='font-sans-semibold text-[15px] text-foreground'>Fund from</Text>
            <CardFundingSource
              wallets={wallets}
              amountUsd={resolvedLimit}
              selectedId={walletId}
              onSelect={setWalletId}
            />
            <CardFundingSummary
              wallet={fundingWallet}
              amountUsd={resolvedLimit}
            />
          </View>
          <View className='flex-row gap-2'>
            <SecondaryButton
              label='Back'
              onPress={() => setStep('limit')}
            />
            <PrimaryButton
              label={busy ? 'Issuing…' : 'Issue card'}
              disabled={busy || !canIssue}
              onPress={() => void issue()}
            />
          </View>
          {onCancelled ? (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Cancel'
              onPress={onCancelled}
              className='items-center justify-center rounded-full px-4 py-2 self-center active:opacity-75'
            >
              <Text className='font-sans-medium text-[14px] text-muted-foreground'>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {step === 'issued' && issued ? <IssuedVirtualCard card={issued} /> : null}

      {modal}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className='flex-row justify-between gap-3'>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>{label}</Text>
      <Text className='font-sans-medium text-[16px] tabular-nums text-foreground'>{value}</Text>
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
      className='flex-1 min-h-[46px] items-center justify-center rounded-full px-4 bg-primary active:opacity-85 disabled:opacity-50'
      style={[
        styles.primary,
        {
          backgroundColor: disabled ? colors.muted : colors.primary,
          opacity: disabled ? 0.7 : 1,
        },
      ]}
    >
      <Text
        className='font-sans-semibold text-[16px] tracking-[-0.2px] text-primary-foreground'
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
      className='flex-1 min-h-[46px] items-center justify-center rounded-full bg-muted px-3.5'
      style={[styles.secondary]}
    >
      <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = {
  shell: {
    borderRadius: Radius.card,
  },
  input: {
    borderRadius: Radius.composer,
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
