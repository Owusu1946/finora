import { memo } from 'react';
import { Pressable, View } from 'react-native';

import type { Invoice } from '@/components/invoices/types';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
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
      className={cx(
        'flex-row items-center gap-3 py-3.5 active:opacity-70',
        !isLast && 'border-b border-border',
      )}
    >
      <View className='h-9 w-9 items-center justify-center rounded-full bg-muted'>
        <Icon
          name='file'
          size={16}
          color={colors.foreground}
        />
      </View>
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          className='font-sans-semibold text-base text-foreground'
          numberOfLines={1}
        >
          {invoice.vendor}
        </Text>
        <Text
          className='font-sans text-[13px] text-muted-foreground'
          numberOfLines={1}
        >
          {invoice.invoiceNumber} · due {formatDue(invoice.dueDate)} · {invoice.source}
        </Text>
      </View>
      <View className='items-end gap-0.5'>
        <Text className='font-sans-semibold text-base text-foreground'>
          {formatPaymentAmount(invoice.amount, invoice.currency)}
        </Text>
        <Text
          className='font-sans-semibold text-xs capitalize'
          style={{ color: STATUS_COLOR[invoice.status] }}
        >
          {invoice.status}
        </Text>
      </View>
    </Pressable>
  );
});
