import { useAui } from '@assistant-ui/react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import {
  defaultPayrollPeriod,
  listActiveEmployees,
  listPayrollRuns,
  type Employee,
  type PayrollRun,
} from '@/lib/employees-storage';
import { haptics } from '@/lib/haptics';

export default function PayrollScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);

  const refresh = useCallback(async () => {
    const [roster, payrollRuns] = await Promise.all([listActiveEmployees(), listPayrollRuns()]);
    setEmployees(roster);
    setRuns(payrollRuns);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Payroll</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Payroll is available on Business accounts. Switch account type in Settings.
        </Text>
      </View>
    );
  }

  if (!employees) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  const total = employees.reduce((sum, e) => sum + e.salary, 0);
  const currency = employees[0]?.currency ?? 'USD';
  const lastRun = runs[0];

  return (
    <LegendList
      data={employees}
      keyExtractor={(employee) => employee.id}
      recycleItems
      showsVerticalScrollIndicator={false}
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior='automatic'
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Payroll</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Team roster for {defaultPayrollPeriod()}. WeWire settles each salary as its own payout
            after approval.
          </Text>
          <View
            style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.composer }]}
          >
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Next run total</Text>
            <Text style={[styles.summaryAmount, { color: colors.foreground }]}>
              {formatPaymentAmount(total, currency)}
            </Text>
            <Text style={[styles.summaryMeta, { color: colors.mutedForeground }]}>
              {employees.length} active employee{employees.length === 1 ? '' : 's'}
              {lastRun
                ? ` · Last run ${new Date(lastRun.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}`
                : ''}
            </Text>
            <Pressable
              onPress={() => {
                haptics.selection();
                router.push('/');
                aui.composer.setText('Run payroll');
                aui.composer.send();
              }}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.foreground, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.btnLabel, { color: colors.background }]}>Run payroll in chat</Text>
            </Pressable>
          </View>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Team</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      renderItem={({ item: employee }) => (
        <View
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: colors.foreground }]}>{employee.name}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {employee.role} · {employee.destination.label}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(employee.salary, employee.currency)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    gap: 10,
    paddingBottom: 10,
  },
  itemSeparator: {
    height: 10,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: -4,
    marginBottom: 6,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 8,
    marginBottom: 6,
  },
  summaryLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryAmount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  summaryMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  btn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
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
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
});
