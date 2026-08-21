import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatPaymentAmount, type PaymentDestinationKind } from '@/components/chat/PaymentConfirmationCard';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp } from '@/lib/agent-follow-up';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

type Args = {
  importId?: string;
  rowId?: string;
  amount?: number;
  currency?: string;
  reference?: string;
};

type Employee = {
  name: string;
  role?: string;
  destination: { label: string; kind: string; value: string };
};

type Result = {
  employee?: Employee;
  amount?: number;
  currency?: string;
  memo?: string;
  preparationId?: string;
  approvalId?: string;
};

function mockTransactionId() {
  return `tx_emp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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
  const [phase, setPhase] = useState<'idle' | 'sending' | 'paid'>('idle');
  const [txId, setTxId] = useState<string | null>(null);
  const finishedRef = useRef(false);

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.composer, borderColor: colors.border },
        ]}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor:
                  phase === 'paid' ? colors.foreground : colors.muted,
              },
            ]}
          >
            {phase === 'sending' ? (
              <LoadingIcon color={colors.foreground} />
            ) : (
              <Icon
                name={phase === 'paid' ? 'check' : 'contacts'}
                size={16}
                color={phase === 'paid' ? colors.background : colors.foreground}
              />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              {phase === 'paid'
                ? 'Paid · Sent via rails'
                : phase === 'sending'
                  ? 'Executing payment…'
                  : 'Employee payment ready'}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {employee.name}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            {formatPaymentAmount(amount, currency)}
          </Text>
        </View>

        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {employee.role || 'Employee'} · {employee.destination.label}
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
              haptics.light();

              await new Promise((r) => setTimeout(r, 850));
              if (finishedRef.current) return;
              finishedRef.current = true;

              const generatedTxId = mockTransactionId();
              setTxId(generatedTxId);

              // Record the payment in local transactions/activity storage
              await recordSentPayment({
                payment: {
                  amount,
                  currency,
                  recipientName: employee.name,
                  destination: {
                    kind:
                      (employee.destination.kind as PaymentDestinationKind) ||
                      'bank_account',
                    label: employee.destination.label,
                    value: employee.destination.value,
                  },
                  reference: memo ?? `Salary · ${employee.name}`,
                  purposeCode: 'SALARY',
                  purposeLabel: 'Salary / employee',
                },
                transactionId: generatedTxId,
                source: 'chat',
              });

              setPhase('paid');
              haptics.success();

              appendAgentFollowUp(
                aui,
                `Paid ${employee.name} ${formatPaymentAmount(amount, currency)}. Ref ${generatedTxId}.`,
              );
            }}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: colors.foreground,
                opacity: pressed || busy ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: colors.background }]}>
              {busy ? 'Verifying…' : 'Approve payment'}
            </Text>
          </Pressable>
        ) : phase === 'sending' ? (
          <View style={[styles.statusBox, { backgroundColor: colors.muted }]}>
            <LoadingIcon color={colors.foreground} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              Authorizing payment and routing to rails…
            </Text>
          </View>
        ) : (
          <View style={[styles.statusBox, { backgroundColor: colors.muted }]}>
            <Icon name="check" size={16} color={colors.foreground} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              Payment complete. Funds moved from your wallet. Ref {txId}
            </Text>
          </View>
        )}
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
    if (status.type === 'running' && !result?.employee) {
      return (
        <View
          style={[
            styles.box,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            Preparing employee payment...
          </Text>
        </View>
      );
    }
    if (!result?.employee || result.amount == null || !result.currency) {
      return (
        <View
          style={[
            styles.box,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            Could not prepare that employee payment. Confirm the employee and
            payroll import.
          </Text>
        </View>
      );
    }
    return (
      <EmployeePayCard
        employee={result.employee}
        amount={result.amount}
        currency={result.currency}
        memo={result.memo}
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
  flex: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    fontWeight: '500',
  },
  btn: {
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusBox: {
    minHeight: 44,
    borderRadius: Radius.composer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
