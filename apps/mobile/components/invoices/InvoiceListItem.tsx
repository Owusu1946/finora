import { memo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';

import type { Invoice } from '@/components/invoices/types';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const STATUS_COLOR: Record<Invoice['status'], string> = {
  due: '#F59E0B',
  scheduled: '#3B82F6',
  paid: '#10B981',
  dismissed: '#71717A',
};

function formatDue(iso: string | null) {
  if (!iso) return 'not specified';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const InvoiceListItem = memo(function InvoiceListItem({
  invoice,
  isLast,
  onPress,
}: {
  invoice: Invoice;
  isLast: boolean;
  onPress?: (invoice: Invoice) => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.(invoice);
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
          name='file'
          size={16}
          color={colors.foreground}
        />
      </View>
      <View style={styles.meta}>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {invoice.vendor}
        </Text>
        <Text
          style={[styles.detail, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {invoice.invoiceNumber} · due {formatDue(invoice.dueDate)} · {invoice.source}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.foreground }]}>
          {formatPaymentAmount(invoice.amount, invoice.currency)}
        </Text>
        <Text style={[styles.status, { color: STATUS_COLOR[invoice.status] }]}>
          {invoice.status}
        </Text>
      </View>
    </Pressable>
  );
});

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
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
