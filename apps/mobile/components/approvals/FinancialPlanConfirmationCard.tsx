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

import type {
  FinancialPlanItem,
  FinancialPlanItemKind,
  FinancialPlanPayload,
} from '@/components/approvals/types';
import {
  formatPaymentAmount,
  type PaymentConfirmationStatus,
} from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type FinancialPlanConfirmationCardProps = {
  plan: FinancialPlanPayload;
  status?: PaymentConfirmationStatus;
  loading?: boolean;
  transactionId?: string;
  sendingStep?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  onViewDetails?: () => void;
};

const SEND_STEPS = ['Authorizing plan', 'Submitting line items', 'Confirming batch'] as const;

function kindLabel(kind: FinancialPlanItemKind): string {
  switch (kind) {
    case 'payroll':
      return 'Payroll';
    case 'invoice':
      return 'Invoice';
    case 'supplier':
      return 'Supplier';
    case 'conversion':
      return 'FX';
    case 'recurring':
      return 'Recurring';
    default:
      return 'Payment';
  }
}

export function FinancialPlanConfirmationCard({
  plan,
  status = 'pending',
  loading = false,
  transactionId,
  sendingStep = 0,
  onConfirm,
  onCancel,
  onViewDetails,
}: FinancialPlanConfirmationCardProps) {
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
    ? 'Plan executed'
    : sending
      ? 'Executing plan…'
      : failed
        ? 'Plan failed'
        : cancelled
          ? 'Plan rejected'
          : 'Confirm financial plan';

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
              name={failed || cancelled ? 'remove' : sent ? 'check' : 'activity'}
              size={16}
              color={failed || cancelled ? colors.destructive : colors.foreground}
            />
          )}
        </Animated.View>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>
          <Text style={[styles.intent, { color: colors.foreground }]}>{plan.intent}</Text>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(plan.total, plan.currency)}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {plan.items.length} item{plan.items.length === 1 ? '' : 's'} · approve once
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.items}>
        {plan.items.map((item, index) => (
          <PlanItemRow
            key={`${item.kind}-${item.label}-${index}`}
            item={item}
            colors={colors}
            isLast={index === plan.items.length - 1}
          />
        ))}
      </View>

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

      {sent ? (
        <View style={styles.sentBlock}>
          {transactionId ? (
            <Text style={[styles.txId, { color: colors.mutedForeground }]}>
              Batch id · {transactionId}
            </Text>
          ) : null}
          {onViewDetails ? (
            <Pressable
              onPress={() => {
                haptics.selection();
                onViewDetails();
              }}
              style={({ pressed }) => [
                styles.linkBtn,
                { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.linkLabel, { color: colors.foreground }]}>
                View in activity
              </Text>
            </Pressable>
          ) : null}
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
            <Text style={[styles.btnLabel, { color: colors.foreground }]}>Reject</Text>
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
              {loading ? 'Confirming…' : 'Approve all'}
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
            {failed ? 'Couldn’t execute plan' : 'Rejected'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PlanItemRow({
  item,
  colors,
  isLast,
}: {
  item: FinancialPlanItem;
  colors: {
    foreground: string;
    mutedForeground: string;
    muted: string;
    border: string;
  };
  isLast: boolean;
}) {
  return (
    <View
      style={[
        styles.itemRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.kindPill, { backgroundColor: colors.muted }]}>
        <Text style={[styles.kindText, { color: colors.mutedForeground }]}>
          {kindLabel(item.kind)}
        </Text>
      </View>
      <View style={styles.itemMeta}>
        <Text
          style={[styles.itemLabel, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {item.label}
        </Text>
      </View>
      <Text style={[styles.itemAmount, { color: colors.foreground }]}>
        {formatPaymentAmount(item.amount, item.currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  intent: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  items: {
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  kindPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kindText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  itemMeta: {
    flex: 1,
    minWidth: 0,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  steps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sentBlock: {
    gap: 10,
  },
  txId: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  linkBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
