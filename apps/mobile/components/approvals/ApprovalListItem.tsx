import { StyleSheet, Text, View, Pressable } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
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

export function ApprovalListItem({ approval, isLast, onPress }: ApprovalListItemProps) {
  const { colors } = useTheme();
  const { status } = approval;
  const isPlan = approval.kind === 'plan';

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.(approval);
      }}
      style={({ pressed }) => [
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
        <Icon
          name={isPlan ? 'activity' : 'shield'}
          size={16}
          color={colors.foreground}
        />
      </View>

      <View style={styles.meta}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {titleFor(approval)}
        </Text>
        <Text
          style={[styles.detail, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {detailFor(approval)}
        </Text>
      </View>

      <View style={styles.right}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[status] }]} />
          <Text style={[styles.statusLabel, { color: STATUS_COLOR[status] }]}>{status}</Text>
        </View>
        <Icon
          name='chevron-right'
          size={16}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  detail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '400',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
