import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export type PaymentDestinationKind = 'mobile_money' | 'bank_account' | 'crypto_wallet';

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
    /** Human label, e.g. "MTN MoMo", "Bank account", "USDT · TRC-20" */
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

export type PaymentConfirmationStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'cancelled'
  | 'failed';

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
      style={[
        styles.card,
        {
          backgroundColor: colors.composer,
          borderColor: colors.border,
        },
      ]}
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
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: failed ? colors.destructiveSurface : colors.muted,
                  opacity: sending ? pulse : 1,
                },
              ]}
            >
              {sending ? (
                <ActivityIndicator
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
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>
              <Text style={[styles.amount, { color: colors.foreground }]}>
                {formatPaymentAmount(payment.amount, payment.currency)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.rows}>
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
            {payment.fundingCurrency &&
            payment.fundingCurrency !== payment.currency ? (
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
        <View style={styles.steps}>
          {SEND_STEPS.map((label, index) => {
            const done = index < sendingStep;
            const active = index === sendingStep;
            return (
              <View
                key={label}
                style={styles.stepRow}
              >
                <View
                  style={[
                    styles.stepDot,
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
                    <ActivityIndicator
                      size='small'
                      color={colors.foreground}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
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
        <View style={styles.actions}>
          <Pressable
            accessibilityRole='button'
            disabled={loading}
            onPress={() => {
              haptics.selection();
              onCancel?.();
            }}
            style={({ pressed }) => [
              styles.btn,
              styles.btnGhost,
              {
                borderColor: colors.border,
                opacity: pressed || loading ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole='button'
            disabled={loading}
            onPress={() => {
              haptics.impact();
              onConfirm?.();
            }}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              {
                backgroundColor: colors.foreground,
                opacity: pressed || loading ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>
              {loading ? 'Confirming…' : 'Confirm & send'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {cancelled || failed ? (
        <View
          style={[
            styles.statusPill,
            { backgroundColor: colors.destructiveSurface },
          ]}
        >
          <Icon
            name='remove'
            size={14}
            color={colors.destructive}
          />
          <Text style={[styles.statusText, { color: colors.destructive }]}>
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
    <Animated.View style={[styles.sentHero, { opacity, transform: [{ scale }] }]}>
      <View style={[styles.sentBadge, { backgroundColor: colors.muted }]}>
        <Icon
          name='check'
          size={28}
          color={colors.foreground}
        />
      </View>
      <Text style={[styles.sentTitle, { color: colors.foreground }]}>Sent</Text>
      <Text style={[styles.sentAmount, { color: colors.foreground }]}>
        {formatPaymentAmount(payment.amount, payment.currency)}
      </Text>
      <Text style={[styles.sentTo, { color: colors.mutedForeground }]}>
        to {payment.recipientName}
      </Text>

      <View style={[styles.receipt, { borderColor: colors.border }]}>
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
              <Text style={[styles.viewDetailsHint, { color: colors.mutedForeground }]}>
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
          style={({ pressed }) => [
            styles.saveContactBtn,
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
          <Text style={[styles.saveContactLabel, { color: colors.foreground }]}>
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
          style={({ pressed }) => [
            styles.saveContactBtn,
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
          <Text style={[styles.saveContactLabel, { color: colors.foreground }]}>
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
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {icon ? (
          <Icon
            name={icon}
            size={13}
            color={colors.mutedForeground}
          />
        ) : null}
        <Text
          selectable
          style={[styles.rowValue, mono && styles.mono, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
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
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  amount: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  rows: {
    gap: 12,
  },
  row: {
    gap: 4,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  mono: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnPrimary: {},
  btnLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  steps: {
    gap: 10,
    paddingTop: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  sentHero: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sentBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sentTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sentAmount: {
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.7,
  },
  sentTo: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  receipt: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    gap: 12,
  },
  saveContactBtn: {
    marginTop: 4,
    width: '100%',
    minHeight: 44,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveContactLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  viewDetailsHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
});
