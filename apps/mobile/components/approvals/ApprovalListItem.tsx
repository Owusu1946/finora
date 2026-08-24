import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

import type { ApprovalRequest } from './types';

interface ApprovalListItemProps {
  approval: ApprovalRequest;
  isLast: boolean;
  onPress?: (approval: ApprovalRequest) => void;
}

const STATUS_COLOR: Record<ApprovalRequest['status'], string> = {
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function titleFor(approval: ApprovalRequest): string {
  if (approval.kind === 'plan' && approval.plan) {
    const { plan } = approval;
    return `Plan · ${formatPaymentAmount(plan.total, plan.currency)} · ${plan.items.length} items`;
  }
  const payment = approval.payment;
  if (!payment) return 'Approval';
  return `${formatPaymentAmount(payment.amount, payment.currency)} → ${payment.recipientName}`;
}

function detailFor(approval: ApprovalRequest): string {
  if (approval.kind === 'plan' && approval.plan) {
    return `${approval.agent} · ${approval.plan.intent} · ${relativeTime(approval.createdAt)}`;
  }
  const payment = approval.payment;
  const dest = payment?.destination.label ?? 'Payment';
  return `${approval.agent} · ${dest} · ${relativeTime(approval.createdAt)}`;
}

export const ApprovalListItem = memo(function ApprovalListItem({
  approval,
  isLast,
  onPress,
}: ApprovalListItemProps) {
  const { colors } = useTheme();
  const { status } = approval;
  const isPlan = approval.kind === 'plan';

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.(approval);
      }}
      className={cx(
        'flex-row items-center gap-3 py-3.5 active:opacity-70',
        !isLast && 'border-b border-border',
      )}
    >
      <View className='h-9 w-9 items-center justify-center rounded-full bg-muted'>
        <Icon
          name={isPlan ? 'activity' : 'shield'}
          size={16}
          color={colors.foreground}
        />
      </View>

      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          className='font-sans-semibold text-base text-foreground'
          numberOfLines={1}
        >
          {titleFor(approval)}
        </Text>
        <Text
          className='font-sans text-[13px] text-muted-foreground'
          numberOfLines={1}
        >
          {detailFor(approval)}
        </Text>
      </View>

      <View className='items-end gap-1'>
        <View className='flex-row items-center gap-1'>
          <View
            className='h-[5px] w-[5px] rounded-full'
            style={{ backgroundColor: STATUS_COLOR[status] }}
          />
          <Text
            className='font-sans-semibold text-xs capitalize'
            style={{ color: STATUS_COLOR[status] }}
          >
            {status}
          </Text>
        </View>
        <Icon
          name='chevron-right'
          size={16}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
});
