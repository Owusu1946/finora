import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

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
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
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
    <View className='gap-3.5 rounded-3xl border border-border bg-composer p-4'>
      <View className='flex-row items-start gap-3'>
        <Animated.View
          className={cx(
            'mt-0.5 h-9 w-9 items-center justify-center rounded-full',
            failed ? 'bg-destructive-surface' : 'bg-muted',
          )}
          style={{ opacity: sending ? pulse : 1 }}
        >
          {sending ? (
            <LoadingIcon
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
        <View className='min-w-0 flex-1 gap-0.5'>
          <Text className='font-sans-semibold text-[13px] text-muted-foreground'>{eyebrow}</Text>
          <Text className='font-sans-semibold text-[17px] text-foreground'>{plan.intent}</Text>
          <Text className='mt-1 font-sans-semibold text-[29px] text-foreground'>
            {formatPaymentAmount(plan.total, plan.currency)}
          </Text>
          <Text className='font-sans-medium text-sm text-muted-foreground'>
            {plan.items.length} item{plan.items.length === 1 ? '' : 's'} · approve once
          </Text>
        </View>
      </View>

      <View className='border-t border-border' />

      <View>
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
        <View className='gap-2.5'>
          {SEND_STEPS.map((label, index) => {
            const done = index < sendingStep;
            const active = index === sendingStep;
            return (
              <View
                key={label}
                className='flex-row items-center gap-2.5'
              >
                <View
                  className='h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px]'
                  style={{
                    borderColor: done || active ? colors.foreground : colors.border,
                    backgroundColor: done ? colors.foreground : 'transparent',
                  }}
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
                  className={cx('text-sm', active ? 'font-sans-semibold' : 'font-sans-medium')}
                  style={{ color: done || active ? colors.foreground : colors.mutedForeground }}
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
        <View className='gap-2.5'>
          {transactionId ? (
            <Text className='font-sans-medium text-[13px] tabular-nums text-muted-foreground'>
              Batch id · {transactionId}
            </Text>
          ) : null}
          {onViewDetails ? (
            <Pressable
              onPress={() => {
                haptics.selection();
                onViewDetails();
              }}
              className='min-h-[42px] items-center justify-center rounded-xl border border-border active:opacity-75'
            >
              <Text className='font-sans-semibold text-[15px] text-foreground'>
                View in activity
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {pending ? (
        <View className='flex-row gap-2.5'>
          <Pressable
            accessibilityRole='button'
            disabled={loading}
            onPress={() => {
              haptics.selection();
              onCancel?.();
            }}
            className='min-h-[46px] flex-1 items-center justify-center rounded-[14px] border border-border active:opacity-70 disabled:opacity-70'
          >
            <Text className='font-sans-semibold text-base text-foreground'>Reject</Text>
          </Pressable>
          <Pressable
            accessibilityRole='button'
            disabled={loading}
            onPress={() => {
              haptics.impact();
              onConfirm?.();
            }}
            className='min-h-[46px] flex-1 items-center justify-center rounded-[14px] bg-foreground active:opacity-85 disabled:opacity-85'
          >
            <Text className='font-sans-semibold text-base text-background'>
              {loading ? 'Confirming…' : 'Approve all'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {cancelled || failed ? (
        <View className='flex-row items-center gap-2 rounded-xl bg-destructive-surface px-3 py-2.5'>
          <Icon
            name='remove'
            size={14}
            color={colors.destructive}
          />
          <Text className='font-sans-semibold text-[15px] text-destructive'>
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
      className={cx('flex-row items-center gap-2.5 py-2.5', !isLast && 'border-b border-border')}
    >
      <View className='rounded-lg bg-muted px-2 py-1'>
        <Text className='font-sans-semibold text-xs text-muted-foreground'>
          {kindLabel(item.kind)}
        </Text>
      </View>
      <View className='min-w-0 flex-1'>
        <Text
          className='font-sans-medium text-[15px] text-foreground'
          numberOfLines={2}
        >
          {item.label}
        </Text>
      </View>
      <Text className='font-sans-semibold text-[15px] text-foreground'>
        {formatPaymentAmount(item.amount, item.currency)}
      </Text>
    </View>
  );
}
