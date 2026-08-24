import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Share, View } from 'react-native';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
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
    <View
      className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
      style={[styles.card]}
    >
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
        <View className='gap-2.5'>
          <View className='flex-row flex-wrap gap-2'>
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
          <View className='flex-row flex-wrap gap-2'>
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
            className='font-sans-medium min-h-[46px] border px-3.5 text-[17px] text-foreground border-border bg-background'
            style={[styles.input]}
          />
        </View>
      ) : null}

      {step === 'memo' ? (
        <View className='gap-2.5'>
          <View className='flex-row flex-wrap gap-2'>
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
            className='font-sans-medium min-h-[46px] border px-3.5 text-[17px] text-foreground border-border bg-background'
            style={[styles.input]}
          />
          <Pressable
            onPress={() => {
              setMemo('');
              setCustomMemo('');
              haptics.selection();
              setStep('review');
            }}
          >
            <Text className='font-sans-semibold text-[15px] text-center py-1 text-muted-foreground'>
              Skip note
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'review' && amount != null ? (
        <View
          className='border p-4 gap-1.5 items-center border-border'
          style={[styles.review]}
        >
          <Text className='font-sans-semibold text-[29px] tracking-[-0.6px] text-foreground'>
            {formatPaymentAmount(amount, currency)}
          </Text>
          {memo.trim() ? (
            <Text className='font-sans-medium text-[15px] text-muted-foreground'>
              “{memo.trim()}”
            </Text>
          ) : (
            <Text className='font-sans-medium text-[15px] text-muted-foreground'>No note</Text>
          )}
          {seed.payerHint ? (
            <Text className='font-sans-medium text-[14px] text-muted-foreground'>
              For {seed.payerHint}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className='flex-row gap-2'>
        <Pressable
          onPress={goBack}
          className='flex-1 min-h-[46px] border items-center justify-center'
          style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text className='font-sans-semibold text-[16px] text-foreground'>
            {stepIndex === 1 ? 'Cancel' : 'Back'}
          </Text>
        </Pressable>
        <Pressable
          disabled={!canContinue}
          onPress={goNext}
          className='flex-[1.4] min-h-[46px] items-center justify-center'
          style={({ pressed }) => [
            {
              backgroundColor: colors.foreground,
              opacity: !canContinue ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text className='font-sans-semibold text-[16px] text-background'>
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
    <View
      className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
      style={[styles.card]}
    >
      <View className='flex-row items-center gap-3'>
        <View className='w-9 h-9 rounded-[18px] items-center justify-center bg-muted'>
          <Icon
            name='qr'
            size={16}
            color={colors.foreground}
          />
        </View>
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            Payment request
          </Text>
          <Text className='font-sans-semibold text-[21px] tracking-[-0.4px] text-foreground'>
            {formatPaymentAmount(request.amount, request.currency)}
          </Text>
        </View>
      </View>

      {request.memo ? (
        <Text className='font-sans-medium text-[15px] italic -mt-1 text-muted-foreground'>
          “{request.memo}”
        </Text>
      ) : null}

      <Pressable
        accessibilityLabel='Expand payment QR'
        onPress={() => {
          haptics.selection();
          setQrOpen(true);
        }}
        className='self-center p-3'
        style={[styles.qrWrap, { backgroundColor: isDark ? '#fff' : colors.background }]}
      >
        <MockQrCode
          value={request.qrPayload}
          size={168}
          color='#18181b'
          backgroundColor='#ffffff'
        />
      </Pressable>
      <Text className='font-sans-medium text-center text-[13px] -mt-1 text-muted-foreground'>
        Tap to enlarge · Link expires {expiresLabel ?? 'in 7 days'}
      </Text>

      <View
        className='flex-row items-center gap-2.5 border px-3 py-2.5 border-border'
        style={[styles.linkRow]}
      >
        <View className='flex-1 gap-0.5'>
          <Text className='font-sans-medium text-[12px] text-muted-foreground'>Payment link</Text>
          <Text
            selectable
            numberOfLines={2}
            className='font-sans-medium text-[14px] tracking-[-0.2px] text-foreground'
          >
            {request.link}
          </Text>
        </View>
        <Pressable
          accessibilityLabel='Copy payment link'
          onPress={() => void copy(request.link, 'link')}
          className='w-[34px] h-[34px] rounded-[17px] items-center justify-center'
          style={({ pressed }) => [{ backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon
            name={copied === 'link' ? 'check' : 'copy'}
            size={15}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <View className='gap-2'>
        <Pressable
          onPress={() => void textSms()}
          className='min-h-[46px] flex-row items-center justify-center gap-2'
          style={({ pressed }) => [
            { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon
            name='phone'
            size={16}
            color={colors.background}
          />
          <Text className='font-sans-semibold text-[16px] text-background'>Text SMS</Text>
        </Pressable>
        <View className='flex-row gap-2'>
          <Pressable
            onPress={share}
            className='min-h-11 border flex-row items-center justify-center gap-1.5'
            style={({ pressed }) => [
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1, flex: 1 },
            ]}
          >
            <Icon
              name='share'
              size={15}
              color={colors.foreground}
            />
            <Text className='font-sans-semibold text-[15px] text-foreground'>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => void copy(shareMessage, 'all')}
            className='min-h-11 border flex-row items-center justify-center gap-1.5'
            style={({ pressed }) => [
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1, flex: 1 },
            ]}
          >
            <Icon
              name={copied === 'all' ? 'check' : 'copy'}
              size={15}
              color={colors.foreground}
            />
            <Text className='font-sans-semibold text-[15px] text-foreground'>
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
          className='flex-1 items-center justify-center p-6'
          style={[{ backgroundColor: 'rgba(0,0,0,0.55)' }]}
          onPress={() => setQrOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className='w-[100%] max-w-[360px] border p-5 gap-3.5 items-center bg-background border-border'
            style={[styles.modalCard]}
          >
            <Text className='font-sans-semibold text-[19px] text-foreground'>
              {formatPaymentAmount(request.amount, request.currency)}
            </Text>
            <View
              className='p-4 bg-white'
              style={[styles.modalQr]}
            >
              <MockQrCode
                value={request.qrPayload}
                size={240}
                color='#18181b'
                backgroundColor='#ffffff'
              />
            </View>
            <Pressable
              onPress={share}
              className='min-h-[46px] flex-row items-center justify-center gap-2'
              style={({ pressed }) => [
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
              <Text className='font-sans-semibold text-[16px] text-background'>Share link</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  input: {
    borderRadius: Radius.composer,
  },
  review: {
    borderRadius: Radius.composer,
  },
  navBtn: {
    borderRadius: Radius.composer,
  },
  navBtnPrimary: {
    borderRadius: Radius.composer,
  },
  qrWrap: {
    borderRadius: Radius.lg,
  },
  linkRow: {
    borderRadius: Radius.composer,
  },
  primaryBtn: {
    borderRadius: Radius.composer,
  },
  secondaryBtnFull: {
    borderRadius: Radius.composer,
  },
  modalCard: {
    borderRadius: Radius.card,
  },
  modalQr: {
    borderRadius: Radius.lg,
  },
};
