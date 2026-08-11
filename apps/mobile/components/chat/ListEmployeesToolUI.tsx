import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { StyleSheet, View } from 'react-native';

import type { Employee } from '@/lib/employees-storage';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListEmployeesResult = {
  employees?: Employee[];
};

export const ListEmployeesToolUI = makeAssistantToolUI<Record<string, never>, ListEmployeesResult>({
  toolName: 'list_employees',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const employees = result?.employees;

    if (status.type === 'running' && !employees) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Loading team roster…
          </Text>
        </View>
      );
    }

    if (!employees?.length) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No employees yet. Open Payroll to add your team, or say “Add employee…”.
          </Text>
        </View>
      );
    }

    const total = employees.reduce((sum, e) => sum + e.salary, 0);
    const currency = employees[0]?.currency ?? 'USD';

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          {employees.length} employee{employees.length === 1 ? '' : 's'} · payroll{' '}
          {formatPaymentAmount(total, currency)}
        </Text>
        {employees.map((employee) => (
          <View
            key={employee.id}
            style={styles.row}
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
