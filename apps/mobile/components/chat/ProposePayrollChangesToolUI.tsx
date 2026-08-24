import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { applyPayrollProposal, cancelPayrollProposal } from '@/lib/payroll-api';

type Change = {
  rowId: string;
  operation: 'update' | 'delete';
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};
type Result = {
  proposalId?: string;
  sourceName?: string;
  before?: { employeeCount?: number; total?: number; currency?: string };
  after?: { employeeCount?: number; total?: number; currency?: string };
  changes?: Change[];
};

const FIELD_LABELS: Record<string, string> = {
  employeeName: 'Name',
  employeeId: 'Employee ID',
  role: 'Position',
  amount: 'Amount',
  currency: 'Currency',
  destinationType: 'Destination type',
  destination: 'Destination',
  rail: 'Network / bank',
  period: 'Pay period',
  payDate: 'Pay date',
  reference: 'Reference',
};

function changeDiffs(change: Change) {
  if (change.operation === 'delete') return [];
  return Object.keys(FIELD_LABELS).flatMap((key) =>
    JSON.stringify(change.before?.[key]) === JSON.stringify(change.after?.[key])
      ? []
      : [
          {
            key,
            label: FIELD_LABELS[key],
            before: String(change.before?.[key] ?? 'Not set'),
            after: String(change.after?.[key] ?? 'Not set'),
          },
        ],
  );
}

export const ProposePayrollChangesToolUI = makeAssistantToolUI<Record<string, unknown>, Result>({
  toolName: 'propose_payroll_changes',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    const { getToken } = useAuth();
    const [phase, setPhase] = useState<'pending' | 'applying' | 'applied' | 'cancelled'>('pending');
    const [error, setError] = useState<string | null>(null);
    if (status.type === 'running' && !result)
      return (
        <View
          style={[styles.loading, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground }}>Preparing payroll changes...</Text>
        </View>
      );
    if (!result?.proposalId || !result.changes)
      return (
        <View
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <Text style={{ color: colors.destructive }}>
            I could not prepare a safe payroll change proposal.
          </Text>
        </View>
      );
    if (phase === 'applied' || phase === 'cancelled')
      return (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}
        >
          <View style={styles.header}>
            <View style={[styles.icon, { backgroundColor: colors.muted }]}>
              <Icon
                name={phase === 'applied' ? 'check' : 'close-circle'}
                size={17}
                color={colors.foreground}
              />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
                {phase === 'applied' ? 'Payroll updated' : 'Changes cancelled'}
              </Text>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {result.sourceName ?? 'Payroll'}
              </Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {phase === 'applied'
              ? 'The approved changes are saved. No money was moved.'
              : 'No payroll data was changed.'}
          </Text>
        </Animated.View>
      );
    const before = result.before ?? {};
    const after = result.after ?? {};
    const cancel = async () => {
      setError(null);
      try {
        await cancelPayrollProposal(result.proposalId!, getToken);
        setPhase('cancelled');
        haptics.selection();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not cancel payroll changes.');
      }
    };
    const approve = async () => {
      setPhase('applying');
      setError(null);
      try {
        await applyPayrollProposal(result.proposalId!, getToken);
        setPhase('applied');
        haptics.success();
      } catch (cause) {
        setPhase('pending');
        setError(cause instanceof Error ? cause.message : 'Could not apply payroll changes.');
      }
    };
    return (
      <Animated.View
        entering={FadeInDown.duration(260)}
        style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}
      >
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: colors.muted }]}>
            <Icon
              name='edit'
              size={17}
              color={colors.foreground}
            />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Review changes</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {result.sourceName ?? 'Payroll'}
            </Text>
          </View>
          <Text style={[styles.count, { color: colors.foreground }]}>{result.changes.length}</Text>
        </View>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {before.employeeCount ?? 0} employees to {after.employeeCount ?? 0} Â·{' '}
          {String(after.currency ?? before.currency ?? '')}{' '}
          {Number(before.total ?? 0).toLocaleString()} to{' '}
          {Number(after.total ?? 0).toLocaleString()}
        </Text>
        <View>
          {result.changes.map((change, index) => {
            const name = String(
              change.before?.employeeName ?? change.after?.employeeName ?? 'Employee',
            );
            const diffs = changeDiffs(change);
            return (
              <Animated.View
                entering={FadeInUp.delay(index * 35).duration(180)}
                key={`${change.rowId}:${index}`}
                style={[styles.change, { borderTopColor: colors.border }]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        change.operation === 'delete' ? colors.destructive : colors.foreground,
                    },
                  ]}
                />
                <View style={styles.flex}>
                  <Text style={[styles.changeName, { color: colors.foreground }]}>{name}</Text>
                  {change.operation === 'delete' ? (
                    <Text style={[styles.meta, { color: colors.destructive }]}>
                      Removed from payroll
                    </Text>
                  ) : (
                    diffs.map((diff) => (
                      <View
                        key={diff.key}
                        style={styles.diff}
                      >
                        <Text style={[styles.diffLabel, { color: colors.mutedForeground }]}>
                          {diff.label}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.oldValue, { color: colors.mutedForeground }]}
                        >
                          {diff.before}
                        </Text>
                        <Icon
                          name='chevron-right'
                          size={12}
                          color={colors.mutedForeground}
                        />
                        <Text
                          numberOfLines={1}
                          style={[styles.newValue, { color: colors.foreground }]}
                        >
                          {diff.after}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
                <Icon
                  name={change.operation === 'delete' ? 'remove' : 'edit'}
                  size={16}
                  color={
                    change.operation === 'delete' ? colors.destructive : colors.mutedForeground
                  }
                />
              </Animated.View>
            );
          })}
        </View>
        {error ? <Text style={{ color: colors.destructive }}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable
            disabled={phase === 'applying'}
            onPress={() => void cancel()}
            style={[styles.secondary, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground }}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={phase === 'applying'}
            onPress={() => void approve()}
            style={[
              styles.primary,
              { backgroundColor: colors.foreground, opacity: phase === 'applying' ? 0.6 : 1 },
            ]}
          >
            <Text style={{ color: colors.background }}>
              {phase === 'applying' ? 'Applying...' : 'Approve changes'}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          Edits payroll data only. No money is moved.
        </Text>
      </Animated.View>
    );
  },
});

const styles = StyleSheet.create({
  loading: {
    marginVertical: 8,
    minHeight: 68,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  card: {
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700' },
  count: { fontSize: 18, fontWeight: '700' },
  meta: { fontSize: 13 },
  change: {
    minHeight: 46,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  changeName: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  diff: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 5 },
  diffLabel: { width: 74, fontSize: 11 },
  oldValue: { maxWidth: 74, fontSize: 12, textDecorationLine: 'line-through' },
  newValue: { flex: 1, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  secondary: {
    flex: 1,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    flex: 1.4,
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { fontSize: 12, textAlign: 'center' },
});
