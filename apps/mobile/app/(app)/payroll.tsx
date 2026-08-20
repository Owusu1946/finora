import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import { listPayrollImports, type PayrollImport, updatePayrollRow } from '@/lib/payroll-api';

export default function PayrollScreen() {
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const router = useRouter();
  const aui = useAui();
  const [imports, setImports] = useState<PayrollImport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingRow, setSavingRow] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setImports(await listPayrollImports(getToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load payroll imports.');
      setImports([]);
    }
  }, [getToken]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  if (!isBusinessAccount()) {
    return <View style={[styles.root, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>Payroll</Text><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Payroll is available on Business accounts.</Text></View>;
  }

  if (!imports) return <View style={[styles.root, { backgroundColor: colors.background }]}><LoadingIcon style={{ marginTop: 40 }} color={colors.mutedForeground} /></View>;

  return (
    <LegendList
      data={imports}
      keyExtractor={(item) => item.id}
      recycleItems
      showsVerticalScrollIndicator={false}
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Payroll</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Imported payroll drafts and reviewed runs. Edit rows here before preparing an approval.</Text>
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <Pressable onPress={() => { haptics.selection(); router.push('/'); aui.composer.setText('Create a payroll from an attachment'); }} style={[styles.btn, { backgroundColor: colors.foreground }]}><Text style={[styles.btnLabel, { color: colors.background }]}>Create payroll in chat</Text></Pressable>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Payroll drafts</Text>
        </View>
      }
      ListEmptyComponent={<View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}><Text style={{ color: colors.mutedForeground }}>No payroll imports yet. Attach a CSV, spreadsheet, PDF, document, or image in chat to create one.</Text></View>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <PayrollImportCard item={item} colors={colors} savingRow={savingRow} onSave={async (rowId, patch) => { setSavingRow(`${item.id}:${rowId}`); try { const updated = await updatePayrollRow(item.id, rowId, patch, getToken); setImports((current) => current?.map((candidate) => candidate.id === updated.id ? updated : candidate) ?? current); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save payroll row.'); } finally { setSavingRow(null); } }} />}
    />
  );
}

function PayrollImportCard({ item, colors, savingRow, onSave }: { item: PayrollImport; colors: ReturnType<typeof useTheme>['colors']; savingRow: string | null; onSave: (rowId: string, patch: Record<string, unknown>) => Promise<void> }) {
  return <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.composer }]}>
    <View style={styles.cardHeader}><View style={styles.rowText}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.sourceName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.rows.length} employees · {item.status} · {item.period ?? 'Period not set'}</Text></View><Text style={[styles.total, { color: colors.foreground }]}>{formatPaymentAmount(item.total, item.currency)}</Text></View>
    {item.rows.map((row) => <EditablePayrollRow key={row.rowId} row={row} colors={colors} saving={savingRow === `${item.id}:${row.rowId}`} onSave={(patch) => onSave(row.rowId, patch)} />)}
    {item.blockingIssues.length ? <Text style={[styles.error, { color: colors.destructive }]}>{item.blockingIssues.length} issue{item.blockingIssues.length === 1 ? '' : 's'} must be fixed before preparation.</Text> : <Text style={[styles.meta, { color: colors.mutedForeground }]}>Validated. Preparation still requires human approval.</Text>}
  </View>;
}

function EditablePayrollRow({ row, colors, saving, onSave }: { row: PayrollImport['rows'][number]; colors: ReturnType<typeof useTheme>['colors']; saving: boolean; onSave: (patch: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(row.employeeName ?? '');
  const [employeeId, setEmployeeId] = useState(row.employeeId ?? '');
  const [role, setRole] = useState(row.role ?? '');
  const [amount, setAmount] = useState(row.amount == null ? '' : String(row.amount));
  const [currency, setCurrency] = useState(row.currency ?? '');
  const [destinationType, setDestinationType] = useState(row.destinationType ?? '');
  const [destination, setDestination] = useState(row.destination ?? '');
  const [rail, setRail] = useState(row.rail ?? '');
  const [period, setPeriod] = useState(row.period ?? '');
  const [payDate, setPayDate] = useState(row.payDate ?? '');
  const [reference, setReference] = useState(row.reference ?? '');
  const dirty = JSON.stringify({ employeeName: name, employeeId, role, amount, currency, destinationType, destination, rail, period, payDate, reference }) !== JSON.stringify({ employeeName: row.employeeName ?? '', employeeId: row.employeeId ?? '', role: row.role ?? '', amount: String(row.amount ?? ''), currency: row.currency ?? '', destinationType: row.destinationType ?? '', destination: row.destination ?? '', rail: row.rail ?? '', period: row.period ?? '', payDate: row.payDate ?? '', reference: row.reference ?? '' });
  return <View style={[styles.employeeRow, { borderTopColor: colors.border }]}>
    <TextInput value={name} onChangeText={setName} placeholder='Employee name' placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
    <View style={styles.inputLine}><TextInput value={employeeId} onChangeText={setEmployeeId} placeholder='Employee ID' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /><TextInput value={role} onChangeText={setRole} placeholder='Role' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /></View>
    <View style={styles.inputLine}><TextInput value={amount} onChangeText={setAmount} keyboardType='decimal-pad' placeholder='Amount' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /><TextInput value={currency} onChangeText={setCurrency} placeholder='Currency' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /></View>
    <View style={styles.inputLine}><TextInput value={destinationType} onChangeText={setDestinationType} placeholder='Destination type' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /><TextInput value={rail} onChangeText={setRail} placeholder='Network / bank' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /></View>
    <View style={styles.inputLine}><TextInput value={destination} onChangeText={setDestination} placeholder='Destination' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /><TextInput value={period} onChangeText={setPeriod} placeholder='Period' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /></View>
    <View style={styles.inputLine}><TextInput value={payDate} onChangeText={setPayDate} placeholder='Pay date YYYY-MM-DD' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} /><TextInput value={reference} onChangeText={setReference} placeholder='Reference' placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.flex, { color: colors.foreground, borderColor: colors.border }]} />{dirty ? <Pressable disabled={saving} onPress={() => void onSave({ employeeName: name, employeeId, role, amount: Number(amount), currency, destinationType, destination, rail, period, payDate: payDate || null, reference })} style={[styles.save, { backgroundColor: colors.foreground, opacity: saving ? 0.5 : 1 }]}><Text style={{ color: colors.background }}>{saving ? 'Saving' : 'Save'}</Text></Pressable> : null}</View>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 20, paddingBottom: 40 }, header: { gap: 10, paddingBottom: 10 }, title: { fontSize: 25, fontWeight: '600' }, subtitle: { fontSize: 15, lineHeight: 20 }, section: { marginTop: 8, fontSize: 13, fontWeight: '600' }, separator: { height: 12 }, empty: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card }, card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card, gap: 12 }, cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' }, cardTitle: { fontSize: 16, fontWeight: '700' }, rowText: { flex: 1, minWidth: 0 }, total: { fontSize: 16, fontWeight: '700' }, meta: { fontSize: 13 }, employeeRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 }, inputLine: { flexDirection: 'row', gap: 8 }, input: { minHeight: 40, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, fontSize: 14 }, flex: { flex: 1 }, save: { minHeight: 40, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, btn: { minHeight: 44, borderRadius: Radius.composer, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, btnLabel: { fontSize: 15, fontWeight: '600' }, error: { fontSize: 13, lineHeight: 18 } });
