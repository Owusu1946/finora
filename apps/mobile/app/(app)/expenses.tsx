import { useAui } from '@assistant-ui/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { listExpenses, type BusinessExpense } from '@/lib/expenses-storage';
import { haptics } from '@/lib/haptics';

export default function ExpensesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [items, setItems] = useState<BusinessExpense[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void listExpenses().then(setItems);
    }, []),
  );

  const total = useMemo(() => (items ?? []).reduce((s, e) => s + e.amount, 0), [items]);

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Expenses</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Business expenses are available on Business accounts.
        </Text>
      </View>
    );
  }

  if (!items) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior='automatic'
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Expenses</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Card and vendor spend this month · {formatPaymentAmount(total, 'USD')}
      </Text>
      <Pressable
        onPress={() => {
          haptics.selection();
          router.push('/');
          aui.composer.setText('Show business expenses this month');
          aui.composer.send();
        }}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.btnLabel, { color: colors.background }]}>Review in chat</Text>
      </Pressable>
      {items.map((e) => (
        <View
          key={e.id}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.foreground }]}>{e.merchant}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {e.category}
              {e.cardLabel ? ` · ${e.cardLabel}` : ''}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(e.amount, e.currency)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 10 },
  title: { fontFamily: 'DMSans_400Regular', fontSize: 25, fontWeight: '600', letterSpacing: -0.4 },
  sub: {
    marginTop: -4,
    marginBottom: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  btn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  btnLabel: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: 'DMSans_400Regular', fontSize: 16, fontWeight: '600' },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500' },
  amount: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
});
