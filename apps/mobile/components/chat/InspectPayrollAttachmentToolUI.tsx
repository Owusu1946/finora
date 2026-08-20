import { makeAssistantToolUI } from '@assistant-ui/react-native';
import type { PayrollInspectionResponse } from '@finora/shared';
import { StyleSheet, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const InspectPayrollAttachmentToolUI = makeAssistantToolUI<
  { attachmentId: string },
  PayrollInspectionResponse
>({
  toolName: 'inspect_payroll_attachment',
  display: 'standalone',
  render: ({ result, status }) => {
    const { colors } = useTheme();
    if (status.type === 'running' || !result) {
      return (
        <View style={[styles.card, styles.loading, { backgroundColor: colors.composer, borderColor: colors.border }]}>
          <LoadingIcon color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground }}>Reading payroll attachment...</Text>
        </View>
      );
    }
    if (!result.ok) {
      return (
        <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Payroll file could not be read</Text>
          <Text style={{ color: colors.mutedForeground }}>{result.errorCode ?? 'Please check the file and try again.'}</Text>
        </View>
      );
    }
    const blocked = (result.blockingIssues?.length ?? 0) > 0;
    return (
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{blocked ? 'Needs review' : 'Payroll extracted'}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{result.sourceName}</Text>
        <View style={styles.summary}>
          <Text style={{ color: colors.foreground }}>{result.rows?.length ?? 0} employees</Text>
          {result.totals ? <Text style={[styles.total, { color: colors.foreground }]}>{formatPaymentAmount(result.totals.total, result.totals.currency)}</Text> : null}
        </View>
        {result.rows?.slice(0, 8).map((row) => (
          <View key={row.rowId} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={{ color: colors.foreground }}>{row.employeeName ?? 'Unnamed employee'}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{row.citations[0]?.location ?? 'Imported row'}</Text>
            </View>
            <Text style={{ color: colors.foreground }}>{row.amount == null ? 'Amount needed' : formatPaymentAmount(row.amount, row.currency ?? 'USD')}</Text>
          </View>
        ))}
        {blocked ? <Text style={[styles.issue, { color: colors.destructive }]}>{result.blockingIssues?.[0]?.message} Fix the flagged rows before approval.</Text> : <Text style={{ color: colors.mutedForeground }}>Validated and ready for payroll preparation. Approval is still required.</Text>}
      </View>
    );
  },
});

const styles = StyleSheet.create({
  card: { width: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card, padding: 16, gap: 10, marginVertical: 6 },
  loading: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0 },
  meta: { fontSize: 12 },
  issue: { fontSize: 13, lineHeight: 18 },
});
