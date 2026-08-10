import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Share, StyleSheet, View } from 'react-native';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { createPaymentAppLink, createPaymentHttpsLink } from '@/lib/open-payment-link';
import { registerPaymentRequest } from '@/lib/payment-request-registry';
import { sendSms } from '@/lib/sms';

export type PaymentRequestSeed = {
  amount?: number;
  currency?: string;
  memo?: string;
  payerHint?: string;
};

export type PaymentRequestResult = {
  preparationId: string;
  amount: number;
  currency: string;
  memo?: string;
  link: string;
  qrPayload: string;
  expiresAt?: string;
};

type Step = 'amount' | 'memo' | 'review';

const STEPS: Step[] = ['amount', 'memo', 'review'];
const AMOUNTS = [25, 50, 100, 250, 500, 1000];
const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR', 'USDT'];
const MEMOS = ['Invoice', 'Rent', 'Shared bill', 'Thanks', 'Other'];

function initialStep(seed: PaymentRequestSeed): Step {
  if (seed.amount == null) return 'amount';
  if (seed.memo == null) return 'memo';
  return 'review';
}

function buildMockRequest(amount: number, currency: string, memo?: string): PaymentRequestResult {
  const preparationId = `prep_payreq_${Date.now().toString(36)}`;
  const link = createPaymentHttpsLink(preparationId);
  // QR + Share open the app into chat (Expo Go / standalone deep link).
  const qrPayload = createPaymentAppLink(preparationId);
  return {
    preparationId,
    amount,
    currency,
    memo: memo?.trim() || undefined,
    link,
    qrPayload,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function PaymentRequestWizard({
  seed,
  onCreated,
  onCancelled,
}: {
  seed: PaymentRequestSeed;
  onCreated?: (request: PaymentRequestResult) => void;
  onCancelled?: () => void;
}) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(() => initialStep(seed));
  const [amount, setAmount] = useState<number | null>(seed.amount ?? null);
  const [currency, setCurrency] = useState(seed.currency ?? 'GHS');
  const [customAmount, setCustomAmount] = useState('');
  const [memo, setMemo] = useState(seed.memo ?? '');
  const [customMemo, setCustomMemo] = useState('');

  const stepIndex = STEPS.indexOf(step) + 1;

  const canContinue = useMemo(() => {
    if (step === 'amount') return amount != null && amount > 0;
    return true;
  }, [amount, step]);

  const goNext = () => {
    if (!canContinue) return;
    haptics.selection();
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]!);
      return;
    }
    const request = buildMockRequest(amount!, currency, memo);
    haptics.success();
    registerPaymentRequest({
      preparationId: request.preparationId,
      amount: request.amount,
      currency: request.currency,
      memo: request.memo,
      link: request.link,
      expiresAt: request.expiresAt,
    });
    onCreated?.(request);
  };

  const goBack = () => {
    haptics.selection();
    const idx = STEPS.indexOf(step);
    if (idx <= 0) {
      onCancelled?.();
      return;
    }
    setStep(STEPS[idx - 1]!);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
      <WizardStepHeader
        step={stepIndex}
        total={STEPS.length}
        title={
          step === 'amount'
            ? 'How much do you want?'
            : step === 'memo'
              ? 'Add a note?'
              : 'Create payment link'
        }
        subtitle={
          step === 'amount'
            ? 'Anyone with the link can pay this amount into Finora.'
            : step === 'memo'
              ? 'Optional — shows on the payment page.'
              : 'Review, then share the link or QR.'
        }
      />

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
            {AMOUNTS.map((n) => (
              <WizardChip
                key={n}
                label={String(n)}
                selected={amount === n && !customAmount}
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
              const n = Number(t.replace(/,/g, ''));
              setAmount(Number.isFinite(n) && n > 0 ? n : null);
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
        </View>
      ) : null}

      {step === 'memo' ? (
        <View style={styles.block}>
          <View style={styles.chips}>
            {MEMOS.map((m) => (
              <WizardChip
                key={m}
                label={m}
                selected={memo === m && m !== 'Other'}
                onPress={() => {
                  if (m === 'Other') {
                    setMemo(customMemo);
                    return;
                  }
                  setMemo(m);
                  setCustomMemo('');
                }}
              />
            ))}
          </View>
          <TextInput
            value={customMemo || ((MEMOS as readonly string[]).includes(memo) ? '' : memo)}
            onChangeText={(t) => {
              setCustomMemo(t);
              setMemo(t);
            }}
            placeholder='Custom note (optional)'
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
          <Pressable
            onPress={() => {
              setMemo('');
              setCustomMemo('');
              haptics.selection();
              setStep('review');
            }}
          >
            <Text style={[styles.skip, { color: colors.mutedForeground }]}>Skip note</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'review' && amount != null ? (
        <View style={[styles.review, { borderColor: colors.border }]}>
          <Text style={[styles.reviewAmount, { color: colors.foreground }]}>
            {formatPaymentAmount(amount, currency)}
          </Text>
          {memo.trim() ? (
            <Text style={[styles.reviewMemo, { color: colors.mutedForeground }]}>
              “{memo.trim()}”
            </Text>
          ) : (
            <Text style={[styles.reviewMemo, { color: colors.mutedForeground }]}>No note</Text>
          )}
          {seed.payerHint ? (
            <Text style={[styles.reviewHint, { color: colors.mutedForeground }]}>
              For {seed.payerHint}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.nav}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [
            styles.navBtn,
            { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.navLabel, { color: colors.foreground }]}>
            {stepIndex === 1 ? 'Cancel' : 'Back'}
          </Text>
        </Pressable>
        <Pressable
          disabled={!canContinue}
          onPress={goNext}
          style={({ pressed }) => [
            styles.navBtnPrimary,
            {
              backgroundColor: colors.foreground,
              opacity: !canContinue ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.navLabelPrimary, { color: colors.background }]}>
            {step === 'review' ? 'Create link' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PaymentRequestCard({ request }: { request: PaymentRequestResult }) {
  const { colors, isDark } = useTheme();
  const [copied, setCopied] = useState<'link' | 'all' | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const expiresLabel = useMemo(() => {
    if (!request.expiresAt) return null;
    try {
      return new Date(request.expiresAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  }, [request.expiresAt]);

  const amountLabel = formatPaymentAmount(request.amount, request.currency);
  const shareMessage = [
    `Payment request · ${amountLabel}`,
    '',
    `Please pay ${amountLabel} securely on Finora.`,
    request.memo ? `Reference: ${request.memo}` : null,
    '',
    'Complete payment:',
    request.link,
  ]
    .filter(Boolean)
    .join('\n');

  const copy = async (value: string, key: 'link' | 'all') => {
    haptics.selection();
    await Clipboard.setStringAsync(value);
    setCopied(key);
    haptics.success();
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
  };

  const share = async () => {
    haptics.selection();
    try {
      await Share.share({
        message: shareMessage,
        title: 'Finora payment link',
      });
    } catch {
      // ignored
    }
  };

  const textSms = async () => {
    haptics.selection();
    const result = await sendSms({ message: shareMessage });
    if (!result.ok) {
      haptics.impact();
      Alert.alert('SMS unavailable', result.error);
      return;
    }
    if (result.result === 'sent') haptics.success();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Icon
            name='qr'
            size={16}
            color={colors.foreground}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Payment request</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {formatPaymentAmount(request.amount, request.currency)}
          </Text>
        </View>
      </View>

      {request.memo ? (
        <Text style={[styles.memo, { color: colors.mutedForeground }]}>“{request.memo}”</Text>
      ) : null}

      <Pressable
        accessibilityLabel='Expand payment QR'
        onPress={() => {
          haptics.selection();
          setQrOpen(true);
        }}
        style={[styles.qrWrap, { backgroundColor: isDark ? '#fff' : colors.background }]}
      >
        <MockQrCode
          value={request.qrPayload}
          size={168}
          color='#18181b'
          backgroundColor='#ffffff'
        />
      </Pressable>
      <Text style={[styles.qrHint, { color: colors.mutedForeground }]}>
        Tap to enlarge · Link expires {expiresLabel ?? 'in 7 days'}
      </Text>

      <View style={[styles.linkRow, { borderColor: colors.border }]}>
        <View style={styles.fieldText}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Payment link</Text>
          <Text
            selectable
            numberOfLines={2}
            style={[styles.fieldValue, { color: colors.foreground }]}
          >
            {request.link}
          </Text>
        </View>
        <Pressable
          accessibilityLabel='Copy payment link'
          onPress={() => void copy(request.link, 'link')}
          style={({ pressed }) => [
            styles.copyBtn,
            { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon
            name={copied === 'link' ? 'check' : 'copy'}
            size={15}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => void textSms()}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon
            name='phone'
            size={16}
            color={colors.background}
          />
          <Text style={[styles.primaryLabel, { color: colors.background }]}>Text SMS</Text>
        </Pressable>
        <View style={styles.secondaryRow}>
          <Pressable
            onPress={share}
            style={({ pressed }) => [
              styles.secondaryBtnFull,
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1, flex: 1 },
            ]}
          >
            <Icon
              name='share'
              size={15}
              color={colors.foreground}
            />
            <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => void copy(shareMessage, 'all')}
            style={({ pressed }) => [
              styles.secondaryBtnFull,
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1, flex: 1 },
            ]}
          >
            <Icon
              name={copied === 'all' ? 'check' : 'copy'}
              size={15}
              color={colors.foreground}
            />
            <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>
              {copied === 'all' ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={qrOpen}
        transparent
        animationType='fade'
        onRequestClose={() => setQrOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={() => setQrOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalCard,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {formatPaymentAmount(request.amount, request.currency)}
            </Text>
            <View style={styles.modalQr}>
              <MockQrCode
                value={request.qrPayload}
                size={240}
                color='#18181b'
                backgroundColor='#ffffff'
              />
            </View>
            <Pressable
              onPress={share}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.foreground,
                  opacity: pressed ? 0.85 : 1,
                  width: '100%',
                },
              ]}
            >
              <Icon
                name='share'
                size={16}
                color={colors.background}
              />
              <Text style={[styles.primaryLabel, { color: colors.background }]}>Share link</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  memo: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: -4,
  },
  block: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 14,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '500',
  },
  skip: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },
  review: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    padding: 16,
    gap: 6,
    alignItems: 'center',
  },
  reviewAmount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 29,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  reviewMemo: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
  },
  reviewHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  nav: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPrimary: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  navLabelPrimary: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  qrWrap: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: Radius.lg,
  },
  qrHint: {
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    marginTop: -4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldText: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
  },
  fieldValue: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: 8,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtnFull: {
    minHeight: 44,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 19,
    fontWeight: '600',
  },
  modalQr: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: '#ffffff',
  },
});
