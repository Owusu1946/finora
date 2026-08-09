import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import type { Employee } from '@/lib/employees-storage';

type CreateEmployeeArgs = {
  name?: string;
  role?: string;
  salary?: number;
  currency?: string;
};

type CreateEmployeeResult = {
  employee?: Employee;
};

function EmployeeAddedCard({ employee }: { employee: Employee }) {
  const { colors } = useTheme();
  const aui = useAui();
  const followedUp = useRef(false);

  useEffect(() => {
    if (followedUp.current) return;
    followedUp.current = true;
    appendAgentFollowUp(
      aui,
      `Added ${employee.name} (${employee.role}) at ${formatPaymentAmount(
        employee.salary,
        employee.currency,
      )}/period. Say “Run payroll” when you’re ready.`,
    );
  }, [aui, employee]);

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Employee added</Text>
      <Text style={[styles.name, { color: colors.foreground }]}>{employee.name}</Text>
      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
        {employee.role} · {formatPaymentAmount(employee.salary, employee.currency)} ·{' '}
        {employee.destination.label}
      </Text>
    </View>
  );
}

export const CreateEmployeeToolUI = makeAssistantToolUI<CreateEmployeeArgs, CreateEmployeeResult>({
  toolName: 'create_employee',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const employee = result?.employee;

    if (status.type === 'running' && !employee) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Adding employee…
          </Text>
        </View>
      );
    }

    if (!employee) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Couldn’t add that employee. Try “Add employee Ama Boateng designer 2500 USD”.
          </Text>
        </View>
      );
    }

    return <EmployeeAddedCard employee={employee} />;
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
    gap: 4,
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
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
});
