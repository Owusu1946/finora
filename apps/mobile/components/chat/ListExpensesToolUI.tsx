import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { BusinessExpense } from '@/lib/expenses-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = { expenses?: BusinessExpense[]; total?: number; currency?: string };

export const ListExpensesToolUI = makeAssistantToolUI<Record<string, never>, Result>({
  toolName: 'list_expenses',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const expenses = result?.expenses;

    if (status.type === 'running' && !expenses) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Loading business expenses…
          </Text>
        </View>
      );
    }

    if (!expenses?.length) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            No business expenses this month.
          </Text>
        </View>
      );
    }

    const total = result?.total ?? expenses.reduce((s, e) => s + e.amount, 0);
    const currency = result?.currency ?? expenses[0]?.currency ?? 'USD';

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          Business expenses · {formatPaymentAmount(total, currency)}
        </Text>
        {expenses.map((e) => (
          <View
            key={e.id}
            style={styles.row}
          >
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.foreground }]}>{e.merchant}</Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                {e.category}
                {e.cardLabel ? ` · ${e.cardLabel}` : ''}
              </Text>
            </View>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatPaymentAmount(e.amount, e.currency)}
            </Text>
          </View>
        ))}
      </View>
    );
  },
});

const styles = StyleSheet.create({
  box: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  card: {
    marginVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  title: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  muted: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500' },
  amount: { fontFamily: 'DMSans_400Regular', fontSize: 14, fontWeight: '600' },
});
