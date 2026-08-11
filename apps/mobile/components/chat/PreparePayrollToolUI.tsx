import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { defaultPayrollPeriod, recordPayrollRun, type Employee } from '@/lib/employees-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type PreparePayrollArgs = {
  period?: string;
  employeeIds?: string[];
};

type PreparePayrollResult = {
  period?: string;
  employees?: Employee[];
  total?: number;
  currency?: string;
  preparationId?: string;
};

function mockTransactionId() {
  return `WW-SAL-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function PayrollConfirmCard({
  period,
  employees,
  total,
  currency,
}: {
  period: string;
  employees: Employee[];
  total: number;
  currency: string;
}) {
  const { colors } = useTheme();
  const aui = useAui();
  const { requestApproval, modal } = usePasscodeApproval();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'sending' || finishedRef.current) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      const txId = mockTransactionId();
      for (const employee of employees) {
        await recordSentPayment({
          payment: {
            amount: employee.salary,
            currency: employee.currency,
            recipientName: employee.name,
            destination: {
              kind: employee.destination.kind,
              label: employee.destination.label,
              value: employee.destination.value,
            },
            reference: `Salary · ${period}`,
            purposeCode: 'SALARY',
            purposeLabel: 'Salary / payroll',
          },
          transactionId: `${txId}-${employee.id}`,
          source: 'chat',
        });
      }
      await recordPayrollRun({
        period,
        total,
        currency,
        employeeIds: employees.map((e) => e.id),
        transactionId: txId,
      });
      setPhase('sent');
      haptics.success();
      appendAgentFollowUp(
        aui,
        `Payroll for ${period} is complete — ${employees.length} employee${
          employees.length === 1 ? '' : 's'
        }, ${formatPaymentAmount(total, currency)}. Ref ${txId}.`,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, currency, employees, period, phase, total]);

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
            {phase === 'sending' ? (
              <ActivityIndicator
                size='small'
                color={colors.foreground}
              />
            ) : (
              <Icon
                name={phase === 'sent' ? 'check' : 'contacts'}
                size={16}
                color={colors.foreground}
              />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {phase === 'sent'
                ? 'Payroll paid'
                : phase === 'sending'
                  ? 'Running payroll…'
                  : 'Payroll ready'}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{period}</Text>
          </View>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(total, currency)}
          </Text>
        </View>

        <View style={styles.lines}>
          {employees.map((employee) => (
            <View
              key={employee.id}
              style={styles.line}
            >
              <View style={styles.lineText}>
                <Text style={[styles.lineName, { color: colors.foreground }]}>{employee.name}</Text>
                <Text style={[styles.lineMeta, { color: colors.mutedForeground }]}>
                  {employee.role} · {employee.destination.label}
                </Text>
              </View>
              <Text style={[styles.lineAmount, { color: colors.foreground }]}>
                {formatPaymentAmount(employee.salary, employee.currency)}
              </Text>
            </View>
          ))}
        </View>

        {phase === 'idle' ? (
          <Pressable
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await requestApproval();
              setBusy(false);
              if (!ok) return;
              setPhase('sending');
            }}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: colors.foreground,
                opacity: pressed || busy ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>Approve payroll</Text>
          </Pressable>
        ) : null}
      </View>
      {modal}
    </>
  );
}

export const PreparePayrollToolUI = makeAssistantToolUI<PreparePayrollArgs, PreparePayrollResult>({
  toolName: 'prepare_payroll',
  display: 'standalone',
  render: ({ args, result, status }) => {
    const { colors } = useTheme();
    const employees = result?.employees;
    const period = result?.period ?? args.period ?? defaultPayrollPeriod();
    const total = result?.total;
    const currency = result?.currency ?? 'USD';

    if (status.type === 'running' && !employees) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.preparingText, { color: colors.mutedForeground }]}>
            Preparing payroll…
          </Text>
        </View>
      );
    }

    if (!employees?.length || total == null) {
      return (
        <View
          style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No active employees on the roster. Add someone in Payroll, then try again.
          </Text>
        </View>
      );
    }

    return (
      <PayrollConfirmCard
        period={period}
        employees={employees}
        total={total}
        currency={currency}
      />
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
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  amount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '700',
  },
  lines: {
    gap: 10,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lineText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  lineName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  lineMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
  },
  lineAmount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  btn: {
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
});
