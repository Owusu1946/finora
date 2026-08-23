import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View, type TextStyle } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export type PaymentDestinationKind =
  | 'mobile_money'
  | 'bank_account'
  | 'crypto_wallet'
  | 'internal_wallet';

export type PaymentFxQuote = {
  from: string;
  to: string;
  rate: number;
  fee: number;
  convertedAmount: number;
};

export type PaymentConfirmation = {
  amount: number;
  currency: string;
  recipientName: string;
  destination: {
    kind: PaymentDestinationKind;
    /** Human label, e.g. "MTN MoMo", "Bank account", "Finora Tag" */
    label: string;
    /** Phone, account number, or wallet address */
    value: string;
  };
  reference?: string;
  destinationCountry?: string;
  countryName?: string;
  settlementMethod?: string;
  settlementMethodLabel?: string;
  purposeCode?: string;
  purposeLabel?: string;
  fundingCurrency?: string;
  fx?: PaymentFxQuote;
  accountName?: string;
  iban?: string;
  swiftBic?: string;
  deliveryHint?: string;
};

export type PaymentConfirmationStatus = 'pending' | 'sending' | 'sent' | 'cancelled' | 'failed';

type PaymentConfirmationCardProps = {
  payment: PaymentConfirmation;
  status?: PaymentConfirmationStatus;
  loading?: boolean;
  /** Mock / live transaction id once sent */
  transactionId?: string;
  sendingStep?: number;
  contactSaved?: boolean;
  contactSaving?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onSaveContact?: () => void;
  /** Opens shared transaction detail (Activity / Approvals) */
  onViewDetails?: () => void;
};

const SEND_STEPS = ['Authorizing', 'Submitting to rails', 'Confirming transfer'] as const;

function destinationKindIcon(kind: PaymentDestinationKind): 'phone' | 'bank' | 'wallet' {
  if (kind === 'mobile_money') return 'phone';
  if (kind === 'bank_account') return 'bank';
  return 'wallet';
}

export function formatPaymentAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency === 'USDT' || currency === 'USDC' ? 'USD' : currency,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace('US$', currency === 'USDT' || currency === 'USDC' ? `${currency} ` : '$');
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function PaymentConfirmationCard({
  payment,
  status = 'pending',
  loading = false,
  transactionId,
  sendingStep = 0,
  contactSaved = false,
  contactSaving = false,
  onConfirm,
  onCancel,
  onSaveContact,
  onViewDetails,
}: PaymentConfirmationCardProps) {
  const { colors } = useTheme();
  const pending = status === 'pending';
  const sending = status === 'sending';
  const sent = status === 'sent';
  const cancelled = status === 'cancelled';
  const failed = status === 'failed';

  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (!sending) {
      pulse.setValue(0.45);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, sending]);

  const eyebrow = sent
    ? 'Payment sent'
    : sending
      ? 'Sending…'
      : failed
        ? 'Payment failed'
        : cancelled
          ? 'Payment cancelled'
          : 'Confirm payment';

  return (
    <View
      className='w-[100%] border p-4 gap-3.5 my-2 bg-composer border-border'
      style={[styles.card]}
    >
      {sent ? (
        <SentHero
          payment={payment}
          transactionId={transactionId}
          colors={colors}
          contactSaved={contactSaved}
          contactSaving={contactSaving}
          onSaveContact={onSaveContact}
          onViewDetails={onViewDetails}
        />
      ) : (
        <>
          <View className='flex-row items-center gap-3'>
            <Animated.View
              className='w-9 h-9 rounded-[18px] items-center justify-center'
              style={[
                {
                  backgroundColor: failed ? colors.destructiveSurface : colors.muted,
                  opacity: sending ? pulse : 1,
                },
              ]}
            >
              {sending ? (
                <LoadingIcon
                  size='small'
                  color={colors.foreground}
                />
              ) : (
                <Icon
                  name={failed ? 'remove' : 'send'}
                  size={16}
                  color={failed ? colors.destructive : colors.foreground}
                />
              )}
            </Animated.View>
            <View className='flex-1 gap-0.5'>
              <Text className='font-sans-medium text-[14px] tracking-[-0.1px] text-muted-foreground'>
                {eyebrow}
              </Text>
              <Text className='font-sans-semibold text-[27px] tracking-[-0.6px] text-foreground'>
                {formatPaymentAmount(payment.amount, payment.currency)}
              </Text>
            </View>
          </View>

          <View className='h-px w-full bg-border' />

          <View className='gap-3'>
            <DetailRow
              label='To'
              value={payment.recipientName}
              colors={colors}
            />
            {payment.countryName || payment.destinationCountry ? (
              <DetailRow
                label='Country'
                value={
                  payment.countryName
                    ? `${payment.countryName}${payment.destinationCountry ? ` (${payment.destinationCountry})` : ''}`
                    : (payment.destinationCountry ?? '')
                }
                colors={colors}
              />
            ) : null}
            {payment.settlementMethodLabel ? (
              <DetailRow
                label='Rail'
                value={payment.settlementMethodLabel}
                colors={colors}
              />
            ) : null}
            <DetailRow
              label={payment.destination.label}
              value={payment.destination.value}
              icon={destinationKindIcon(payment.destination.kind)}
              mono
              colors={colors}
            />
            {payment.iban ? (
              <DetailRow
                label='IBAN'
                value={payment.iban}
                mono
                colors={colors}
              />
            ) : null}
            {payment.swiftBic ? (
              <DetailRow
                label='SWIFT'
                value={payment.swiftBic}
                mono
                colors={colors}
              />
            ) : null}
            {payment.purposeLabel ? (
              <DetailRow
                label='Purpose'
                value={payment.purposeLabel}
                colors={colors}
              />
            ) : null}
            {payment.fundingCurrency && payment.fundingCurrency !== payment.currency ? (
              <DetailRow
                label='Fund from'
                value={payment.fundingCurrency}
                colors={colors}
              />
            ) : null}
            {payment.fx ? (
              <DetailRow
                label='FX'
                value={`1 ${payment.fx.from} = ${payment.fx.rate} ${payment.fx.to} · fee ${formatPaymentAmount(payment.fx.fee, payment.fx.from)}`}
                colors={colors}
              />
            ) : null}
            {payment.deliveryHint ? (
              <DetailRow
                label='Delivery'
                value={payment.deliveryHint}
                colors={colors}
              />
            ) : null}
            {payment.reference ? (
              <DetailRow
                label='Reference'
                value={payment.reference}
                colors={colors}
              />
            ) : null}
          </View>
        </>
      )}

      {sending ? (
        <View className='gap-2.5 pt-0.5'>
          {SEND_STEPS.map((label, index) => {
            const done = index < sendingStep;
            const active = index === sendingStep;
            return (
              <View
                key={label}
                className='flex-row items-center gap-2.5'
              >
                <View
                  className='w-[22px] h-[22px] rounded-[11px] border items-center justify-center'
                  style={[
                    {
                      borderColor: done || active ? colors.foreground : colors.border,
                      backgroundColor: done ? colors.foreground : 'transparent',
                    },
                  ]}
                >
                  {done ? (
                    <Icon
                      name='check'
                      size={10}
                      color={colors.background}
                    />
                  ) : active ? (
                    <LoadingIcon
                      size='small'
                      color={colors.foreground}
                    />
                  ) : null}
                </View>
                <Text
                  className='font-sans text-[15px] tracking-[-0.2px]'
                  style={[
                    {
                      color: done || active ? colors.foreground : colors.mutedForeground,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                >
                  {label}
                  {active ? '…' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {pending ? (
        <View className='flex-row gap-2.5 mt-0.5'>
          <Pressable
            accessibilityRole='button'
            disabled={loading}
            onPress={() => {
              haptics.selection();
              onCancel?.();
            }}
            className='flex-1 min-h-[46px] items-center justify-center px-3.5 border'
            style={({ pressed }) => [
              {
                borderColor: colors.border,
                opacity: pressed || loading ? 0.7 : 1,
              },
            ]}
          >
            <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole='button'
            disabled={loading}
            onPress={() => {
              haptics.impact();
              onConfirm?.();
            }}
            className='flex-1 min-h-[46px] items-center justify-center px-3.5'
            style={({ pressed }) => [
              {
                backgroundColor: colors.foreground,
                opacity: pressed || loading ? 0.85 : 1,
              },
            ]}
          >
            <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-background'>
              {loading ? 'Confirming…' : 'Confirm & send'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {cancelled || failed ? (
        <View
          className='flex-row items-center gap-2 self-start px-3 py-2 bg-destructive-surface'
          style={[styles.statusPill]}
        >
          <Icon
            name='remove'
            size={14}
            color={colors.destructive}
          />
          <Text className='font-sans-semibold text-[14px] tracking-[-0.1px] text-destructive'>
            {failed ? 'Couldn’t complete transfer' : 'Cancelled'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SentHero({
  payment,
  transactionId,
  colors,
  contactSaved,
  contactSaving,
  onSaveContact,
  onViewDetails,
}: {
  payment: PaymentConfirmation;
  transactionId?: string;
  colors: {
    foreground: string;
    mutedForeground: string;
    muted: string;
    border: string;
    background: string;
  };
  contactSaved?: boolean;
  contactSaving?: boolean;
  onSaveContact?: () => void;
  onViewDetails?: () => void;
}) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <Animated.View
      className='items-center gap-2 pt-2 pb-1'
      style={[{ opacity, transform: [{ scale }] }]}
    >
      <View className='w-16 h-16 rounded-[32px] items-center justify-center mb-1 bg-muted'>
        <Icon
          name='check'
          size={28}
          color={colors.foreground}
        />
      </View>
      <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>Sent</Text>
      <Text className='font-sans-semibold text-[31px] tracking-[-0.7px] text-foreground'>
        {formatPaymentAmount(payment.amount, payment.currency)}
      </Text>
      <Text className='font-sans-medium text-[16px] tracking-[-0.2px] mb-2 text-muted-foreground'>
        to {payment.recipientName}
      </Text>

      <View className='w-[100%] border-t pt-3.5 gap-3 border-border'>
        <DetailRow
          label={payment.destination.label}
          value={payment.destination.value}
          icon={destinationKindIcon(payment.destination.kind)}
          mono
          colors={colors}
        />
        {transactionId ? (
          <Pressable
            disabled={!onViewDetails}
            onPress={() => {
              if (!onViewDetails) return;
              haptics.selection();
              onViewDetails();
            }}
          >
            <DetailRow
              label='Transaction'
              value={transactionId}
              mono
              colors={colors}
            />
            {onViewDetails ? (
              <Text className='font-sans-medium mt-1 text-[13px] text-muted-foreground'>
                Tap to view details
              </Text>
            ) : null}
          </Pressable>
        ) : null}
        {payment.reference ? (
          <DetailRow
            label='Reference'
            value={payment.reference}
            colors={colors}
          />
        ) : null}
      </View>

      {onViewDetails ? (
        <Pressable
          onPress={() => {
            haptics.selection();
            onViewDetails();
          }}
          className='mt-1 w-[100%] min-h-11 border flex-row items-center justify-center gap-2'
          style={({ pressed }) => [
            {
              borderColor: colors.border,
              backgroundColor: 'transparent',
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Icon
            name='activity'
            size={16}
            color={colors.foreground}
          />
          <Text className='font-sans-semibold text-[15px] tracking-[-0.2px] text-foreground'>
            View transaction
          </Text>
        </Pressable>
      ) : null}

      {onSaveContact ? (
        <Pressable
          disabled={contactSaved || contactSaving}
          onPress={() => {
            haptics.selection();
            onSaveContact();
          }}
          className='mt-1 w-[100%] min-h-11 border flex-row items-center justify-center gap-2'
          style={({ pressed }) => [
            {
              borderColor: colors.border,
              backgroundColor: contactSaved ? colors.muted : 'transparent',
              opacity: pressed && !contactSaved ? 0.75 : 1,
            },
          ]}
        >
          <Icon
            name={contactSaved ? 'check' : 'contacts'}
            size={16}
            color={colors.foreground}
          />
          <Text className='font-sans-semibold text-[15px] tracking-[-0.2px] text-foreground'>
            {contactSaving ? 'Saving…' : contactSaved ? 'Saved to contacts' : 'Save contact'}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function DetailRow({
  label,
  value,
  icon,
  mono,
  colors,
}: {
  label: string;
  value: string;
  icon?: 'phone' | 'bank' | 'wallet';
  mono?: boolean;
  colors: {
    foreground: string;
    mutedForeground: string;
  };
}) {
  return (
    <View className='gap-1'>
      <Text className='font-sans-medium text-[13px] tracking-[-0.1px] text-muted-foreground'>
        {label}
      </Text>
      <View className='flex-row items-center gap-1.5'>
        {icon ? (
          <Icon
            name={icon}
            size={13}
            color={colors.mutedForeground}
          />
        ) : null}
        <Text
          selectable
          className='font-sans-medium flex-1 text-[16px] tracking-[-0.2px] text-foreground'
          style={[mono && styles.mono]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.card,
  },
  mono: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  btn: {
    borderRadius: Radius.composer,
  },
  statusPill: {
    borderRadius: Radius.pill,
  },
  saveContactBtn: {
    borderRadius: Radius.composer,
  },
} as const;
