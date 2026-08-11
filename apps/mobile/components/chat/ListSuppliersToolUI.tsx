import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { Supplier } from '@/lib/suppliers-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListSuppliersResult = {
  suppliers?: Supplier[];
};

export const ListSuppliersToolUI = makeAssistantToolUI<Record<string, never>, ListSuppliersResult>({
  toolName: 'list_suppliers',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const suppliers = result?.suppliers;

    if (status.type === 'running' && !suppliers) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Loading suppliers…
          </Text>
        </View>
      );
    }

    if (!suppliers?.length) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No suppliers saved yet. Open Suppliers in the drawer to review the directory.
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'}
        </Text>
        {suppliers.map((supplier) => (
          <View
            key={supplier.id}
            style={styles.row}
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.foreground }]}>{supplier.name}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {supplier.destination.label}
                {supplier.notes ? ` · ${supplier.notes}` : ''}
              </Text>
            </View>
            {supplier.defaultAmount != null ? (
              <Text style={[styles.amount, { color: colors.foreground }]}>
                {formatPaymentAmount(supplier.defaultAmount, supplier.currency)}
              </Text>
            ) : (
              <Text style={[styles.amount, { color: colors.mutedForeground }]}>
                {supplier.currency}
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  },
});

const styles = StyleSheet.create({
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  preparingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  empty: {
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  card: {
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
});
