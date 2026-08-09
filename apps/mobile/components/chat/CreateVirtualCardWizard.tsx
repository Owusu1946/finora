import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import {
  formatCardAmount,
  type CreateVirtualCardInput,
  type VirtualCard,
} from '@/components/cards/types';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
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
  const router = useRouter();
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
    spendLimit ??
    (customLimit.trim() ? Number(customLimit.replace(/,/g, '')) : null);

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
      style={
        step === 'issued'
          ? styles.issuedShell
          : [styles.shell, { backgroundColor: colors.composer, borderColor: colors.border }]
      }
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
        <View style={styles.block}>
          <View style={styles.chips}>
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
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
          <PrimaryButton
            label='Continue'
            disabled={!resolvedLabel}
            onPress={() => setStep('limit')}
          />
        </View>
      ) : null}

      {step === 'limit' ? (
        <View style={styles.block}>
          <View style={styles.chips}>
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
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
          <View style={styles.rowActions}>
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
        <View style={styles.block}>
          <View style={[styles.review, { borderColor: colors.border }]}>
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
          <View style={styles.rowActions}>
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
              style={styles.cancel}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {step === 'issued' && issued ? (
        <View style={styles.issuedBlock}>
          <View style={styles.issuedCardFrame}>
            <VirtualCardFace
              card={issued}
              appear
              tilt={false}
            />
          </View>
          <View style={styles.issuedCopy}>
            <Text style={[styles.issuedTitle, { color: colors.foreground }]}>Card ready</Text>
            <Text style={[styles.issuedSub, { color: colors.mutedForeground }]}>
              {issued.label} · •••• {issued.last4} · {issued.currency}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.selection();
              router.push(`/card/${issued.id}` as Href);
            }}
            style={({ pressed }) => [
              styles.manageButton,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.manageButtonText, { color: colors.foreground }]}>Manage card</Text>
          </Pressable>
        </View>
      ) : null}

      {modal}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewKey, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.reviewVal, { color: colors.foreground }]}>{value}</Text>
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
      style={[
        styles.primary,
        {
          backgroundColor: disabled ? colors.muted : colors.primary,
          opacity: disabled ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.primaryText, { color: disabled ? colors.mutedForeground : colors.primaryForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.secondary, { borderColor: colors.border }]}
    >
      <Text style={[styles.secondaryText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    gap: 12,
  },
  issuedShell: {
    width: '100%',
    marginVertical: 10,
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
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
  },
  secondary: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cancelText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  review: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: 12,
    gap: 10,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewKey: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  reviewVal: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  issuedTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  issuedSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  issuedBlock: {
    width: '100%',
    gap: 12,
  },
  issuedCardFrame: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  issuedCopy: {
    gap: 2,
    paddingHorizontal: 4,
  },
  manageButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginLeft: 4,
  },
  manageButtonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
});
