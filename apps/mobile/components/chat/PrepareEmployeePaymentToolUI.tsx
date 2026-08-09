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
import type { Employee } from '@/lib/employees-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type Args = {
  employeeId?: string;
  amount?: number;
  currency?: string;
  memo?: string;
};

type Result = {
  employee?: Employee;
  amount?: number;
  currency?: string;
  memo?: string;
};

function mockTransactionId() {
  return `WW-EMP-${Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase()}`;
}

function EmployeePayCard({
  employee,
  amount,
  currency,
  memo,
}: {
  employee: Employee;
  amount: number;
  currency: string;
  memo?: string;
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
      await recordSentPayment({
        payment: {
          amount,
          currency,
          recipientName: employee.name,
          destination: {
            kind: employee.destination.kind,
            label: employee.destination.label,
            value: employee.destination.value,
          },
          reference: memo ?? `Employee payment · ${employee.name}`,
          purposeCode: 'SALARY',
          purposeLabel: 'Salary / payroll',
        },
        transactionId: txId,
        source: 'chat',
      });
      setPhase('sent');
      haptics.success();
      appendAgentFollowUp(
        aui,
        `Paid ${employee.name} ${formatPaymentAmount(amount, currency)}. Ref ${txId}.`,
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [amount, aui, currency, employee, memo, phase]);

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
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {phase === 'sent'
                ? 'Employee paid'
                : phase === 'sending'
                  ? 'Paying employee…'
                  : 'Employee payment ready'}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{employee.name}</Text>
          </View>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(amount, currency)}
          </Text>
        </View>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {employee.role} · {employee.destination.label}
          {memo ? ` · ${memo}` : ''}
        </Text>
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
              { backgroundColor: colors.foreground, opacity: pressed || busy ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>Approve payment</Text>
          </Pressable>
        ) : null}
      </View>
      {modal}
    </>
  );
}

export const PrepareEmployeePaymentToolUI = makeAssistantToolUI<Args, Result>({
  toolName: 'prepare_employee_payment',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const employee = result?.employee;
    const amount = result?.amount;
    const currency = result?.currency;

    if (status.type === 'running' && !employee) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            Preparing employee payment…
          </Text>
        </View>
      );
    }

    if (!employee || amount == null || !currency) {
      return (
        <View
          style={[styles.box, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            Couldn’t prepare that employee payment. Try “Pay Ama 500 USD bonus”.
          </Text>
        </View>
      );
    }

    return (
      <EmployeePayCard
        employee={employee}
        amount={amount}
        currency={currency}
        memo={result?.memo}
      />
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
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
    marginVertical: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  eyebrow: { fontFamily: 'DMSans_400Regular', fontSize: 12, fontWeight: '600' },
  title: { fontFamily: 'DMSans_400Regular', fontSize: 16, fontWeight: '600' },
  amount: { fontFamily: 'DMSans_400Regular', fontSize: 16, fontWeight: '700' },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 13, fontWeight: '500' },
  btn: {
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: { fontFamily: 'DMSans_400Regular', fontSize: 15, fontWeight: '600' },
});
