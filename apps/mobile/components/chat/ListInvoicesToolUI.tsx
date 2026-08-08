import { AppText as Text } from '@/components/ui/text';
import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { Invoice } from '@/components/invoices/types';

import { InvoiceCard } from '@/components/chat/InvoiceCard';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListInvoicesArgs = {
  source?: 'gmail' | 'all';
  status?: 'due' | 'all';
};

type ListInvoicesResult = {
  invoices?: Invoice[];
};

export const ListInvoicesToolUI = makeAssistantToolUI<ListInvoicesArgs, ListInvoicesResult>({
  toolName: 'list_invoices',
  display: 'standalone',
  render: ({ args, result, status }) => {
    const { colors } = useTheme();
    const invoices = result?.invoices;

    if (status.type === 'running' && !invoices) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Scanning {args?.source === 'gmail' ? 'Gmail' : 'invoices'}…
          </Text>
        </View>
      );
    }

    if (!invoices?.length) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No unpaid supplier invoices found. Connect Gmail in Integrations or add one manually.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.stack}>
        <Text style={[styles.stackTitle, { color: colors.mutedForeground }]}>
          {invoices.length} supplier invoice{invoices.length === 1 ? '' : 's'}
        </Text>
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
          />
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
  stack: {
    gap: 4,
    marginVertical: 4,
  },
  stackTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
    marginBottom: 2,
  },
});
