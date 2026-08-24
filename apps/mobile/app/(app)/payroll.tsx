import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeOutLeft,
  LinearTransition,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';
import {
  bulkArchivePayrollImports,
  bulkDeletePayrollRows,
  deletePayrollRow,
  listPayrollImports,
  type PayrollImport,
  updatePayrollRow,
} from '@/lib/payroll-api';

type Row = PayrollImport['rows'][number];
type Colors = ReturnType<typeof useTheme>['colors'];
type Selection =
  | { kind: 'imports'; ids: string[] }
  | { kind: 'rows'; importId: string; rowIds: string[] };

export default function PayrollScreen() {
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const router = useRouter();
  const aui = useAui();
  const insets = useSafeAreaInsets();

  const [imports, setImports] = useState<PayrollImport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ importId: string; row: Row } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setImports(await listPayrollImports(getToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load payroll imports.');
      setImports([]);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const selectionCount =
    selection?.kind === 'imports' ? selection.ids.length : (selection?.rowIds.length ?? 0);

  const selectedNames = useMemo(() => {
    if (!selection || !imports) return [];
    if (selection.kind === 'imports') {
      return imports
        .filter((item) => selection.ids.includes(item.id))
        .map((item) => item.sourceName);
    }
    return (
      imports
        .find((item) => item.id === selection.importId)
        ?.rows.filter((row) => selection.rowIds.includes(row.rowId))
        .map((row) => row.employeeName ?? 'Unnamed employee') ?? []
    );
  }, [imports, selection]);

  if (!isBusinessAccount()) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Payroll</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Payroll management is available on Business accounts.
          </Text>
        </View>
      </View>
    );
  }

  if (!imports) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LoadingIcon
          style={{ marginTop: 40 }}
          color={colors.mutedForeground}
        />
      </View>
    );
  }

  const replaceImport = (updated: PayrollImport) =>
    setImports(
      (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? current,
    );

  const mutationError = async (cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : fallback;
    if (message === 'payroll_import_stale') {
      setSelection(null);
      await refresh();
      setError('Payroll changed elsewhere. The latest version has been loaded.');
    } else {
      setError(message);
    }
  };

  const save = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    const key = `${selected.importId}:${selected.row.rowId}`;
    setBusy(key);
    try {
      const updated = await updatePayrollRow(
        selected.importId,
        selected.row.rowId,
        patch,
        getToken,
      );
      replaceImport(updated);
      const row = updated.rows.find((candidate) => candidate.rowId === selected.row.rowId);
      if (row) setSelected({ importId: selected.importId, row });
      haptics.success();
    } catch (cause) {
      await mutationError(cause, 'Could not save payroll employee.');
    } finally {
      setBusy(null);
    }
  };

  const removeRow = async (importId: string, rowId: string) => {
    const key = `${importId}:${rowId}`;
    setBusy(key);
    try {
      const updated = await deletePayrollRow(importId, rowId, getToken);
      replaceImport(updated);
      if (selected?.row.rowId === rowId) setSelected(null);
      haptics.success();
    } catch (cause) {
      await mutationError(cause, 'Could not delete payroll employee.');
    } finally {
      setBusy(null);
    }
  };

  const promptDeleteRow = (importId: string, row: Row, onCancel?: () => void) => {
    const name = row.employeeName || 'this employee';
    haptics.light();
    Alert.alert(
      `Delete ${name}?`,
      `Are you sure you want to remove ${name} from payroll? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => onCancel?.(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void removeRow(importId, row.rowId),
        },
      ],
    );
  };

  const toggleImport = (importId: string) => {
    haptics.selection();
    setSelection((current) => {
      if (!current || current.kind === 'rows') {
        return { kind: 'imports', ids: [importId] };
      }
      return {
        kind: 'imports',
        ids: current.ids.includes(importId)
          ? current.ids.filter((id) => id !== importId)
          : [...current.ids, importId],
      };
    });
  };

  const toggleRow = (importId: string, rowId: string) => {
    haptics.selection();
    setSelection((current) => {
      if (!current || current.kind === 'imports' || current.importId !== importId) {
        return { kind: 'rows', importId, rowIds: [rowId] };
      }
      return {
        kind: 'rows',
        importId,
        rowIds: current.rowIds.includes(rowId)
          ? current.rowIds.filter((id) => id !== rowId)
          : [...current.rowIds, rowId],
      };
    });
  };

  const toggleAllRows = (item: PayrollImport) => {
    haptics.selection();
    setSelection((current) => ({
      kind: 'rows',
      importId: item.id,
      rowIds:
        current?.kind === 'rows' &&
        current.importId === item.id &&
        current.rowIds.length === item.rows.length
          ? []
          : item.rows.map((row) => row.rowId),
    }));
  };

  const deleteSelection = async () => {
    if (!selection || !selectionCount) return;
    setBusy('bulk');
    try {
      if (selection.kind === 'imports') {
        const targets = imports.filter((item) => selection.ids.includes(item.id));
        await bulkArchivePayrollImports(
          targets.map((item) => ({ importId: item.id, version: item.version })),
          getToken,
        );
        setImports(
          (current) => current?.filter((item) => !selection.ids.includes(item.id)) ?? current,
        );
      } else {
        const item = imports.find((candidate) => candidate.id === selection.importId);
        if (!item) throw new Error('payroll_import_not_found');
        replaceImport(
          await bulkDeletePayrollRows(item.id, selection.rowIds, item.version, getToken),
        );
      }
      setSelection(null);
      haptics.success();
    } catch (cause) {
      await mutationError(cause, 'Could not delete the selected payroll data.');
    } finally {
      setBusy(null);
    }
  };

  const confirmDeleteBulk = () => {
    const target =
      selection?.kind === 'imports'
        ? `${selectionCount} payroll${selectionCount === 1 ? '' : 's'}`
        : `${selectionCount} employee${selectionCount === 1 ? '' : 's'}`;
    const preview =
      selectedNames.slice(0, 3).join(', ') +
      (selectedNames.length > 3 ? ` and ${selectedNames.length - 3} more` : '');
    haptics.light();
    Alert.alert(`Delete ${target}?`, preview, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteSelection() },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LegendList
        data={imports}
        keyExtractor={(item) => item.id}
        recycleItems
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          selection ? { paddingBottom: 116 + insets.bottom } : null,
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.rowText}>
                <Text style={[styles.title, { color: colors.foreground }]}>Payroll</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  {selection
                    ? 'Select payrolls or employees to perform batch actions.'
                    : 'Tap an employee to edit details. Swipe left to delete.'}
                </Text>
              </View>
              {imports.length ? (
                <Pressable
                  onPress={() => {
                    haptics.selection();
                    setSelection((current) => (current ? null : { kind: 'imports', ids: [] }));
                  }}
                  style={styles.selectButton}
                >
                  <Text style={[styles.selectLabel, { color: colors.foreground }]}>
                    {selection ? 'Done' : 'Select'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            ) : null}
            {!selection ? (
              <Pressable
                onPress={() => {
                  haptics.selection();
                  router.push('/');
                  aui.composer.setText('Create a payroll from an attachment');
                }}
                style={[styles.btn, { backgroundColor: colors.foreground }]}
              >
                <Text style={[styles.btnLabel, { color: colors.background }]}>
                  Create payroll in chat
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View
            style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.composer }]}
          >
            <Text style={{ color: colors.mutedForeground }}>
              No payroll imports yet. Attach a payroll file in chat to create one.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Animated.View
            layout={LinearTransition.springify()}
            exiting={FadeOutLeft.duration(180)}
          >
            <ImportCard
              item={item}
              colors={colors}
              busy={busy}
              selection={selection}
              onOpen={(row) => setSelected({ importId: item.id, row })}
              onRequestDeleteRow={(row, resetSwipe) => promptDeleteRow(item.id, row, resetSwipe)}
              onToggleImport={() => toggleImport(item.id)}
              onToggleRow={(rowId) => toggleRow(item.id, rowId)}
              onToggleAllRows={() => toggleAllRows(item)}
            />
          </Animated.View>
        )}
      />

      {selection && selectionCount ? (
        <View
          style={[
            styles.bulkBar,
            { bottom: Math.max(insets.bottom, 12), backgroundColor: colors.foreground },
          ]}
        >
          <View>
            <Text style={[styles.bulkCount, { color: colors.background }]}>
              {selectionCount} selected
            </Text>
            <Text style={[styles.bulkMeta, { color: colors.background }]}>
              {selection.kind === 'imports' ? 'Payrolls' : 'Employees'}
            </Text>
          </View>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='Delete selected'
            disabled={busy === 'bulk'}
            onPress={confirmDeleteBulk}
            style={[styles.bulkDelete, { backgroundColor: colors.destructive }]}
          >
            {busy === 'bulk' ? (
              <LoadingIcon color='#fff' />
            ) : (
              <>
                <Icon
                  name='remove'
                  size={18}
                  color='#fff'
                />
                <Text style={styles.bulkDeleteText}>Delete</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      <Editor
        selected={selected}
        colors={colors}
        busy={selected ? busy === `${selected.importId}:${selected.row.rowId}` : false}
        onClose={() => setSelected(null)}
        onSave={save}
      />
    </View>
  );
}

function ImportCard({
  item,
  colors,
  busy,
  selection,
  onOpen,
  onRequestDeleteRow,
  onToggleImport,
  onToggleRow,
  onToggleAllRows,
}: {
  item: PayrollImport;
  colors: Colors;
  busy: string | null;
  selection: Selection | null;
  onOpen: (row: Row) => void;
  onRequestDeleteRow: (row: Row, resetSwipe?: () => void) => void;
  onToggleImport: () => void;
  onToggleRow: (rowId: string) => void;
  onToggleAllRows: () => void;
}) {
  const importSelected = selection?.kind === 'imports' && selection.ids.includes(item.id);
  const selectedRows =
    selection?.kind === 'rows' && selection.importId === item.id ? selection.rowIds : [];
  const allRowsSelected = item.rows.length > 0 && selectedRows.length === item.rows.length;

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: importSelected || selectedRows.length ? colors.foreground : colors.border,
          backgroundColor: colors.composer,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Pressable
          disabled={!selection}
          onPress={onToggleImport}
          style={styles.cardHeadingPress}
        >
          {selection ? (
            <SelectionMark
              selected={importSelected}
              colors={colors}
            />
          ) : null}
          <View style={styles.rowText}>
            <Text
              style={[styles.cardTitle, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {item.sourceName}
            </Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {item.rows.length} employees · {item.status} · {item.period ?? 'Period not set'}
            </Text>
          </View>
        </Pressable>
        <View style={styles.cardTotal}>
          <Text style={[styles.total, { color: colors.foreground }]}>
            {formatPaymentAmount(item.total, item.currency)}
          </Text>
          {selection?.kind === 'rows' && selection.importId === item.id ? (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={
                allRowsSelected ? 'Clear employee selection' : 'Select all employees'
              }
              onPress={onToggleAllRows}
              style={styles.selectAll}
            >
              <Text style={[styles.selectAllText, { color: colors.mutedForeground }]}>
                {allRowsSelected ? 'Clear' : 'All'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {item.rows.map((row) => (
        <EmployeeRow
          key={row.rowId}
          row={row}
          colors={colors}
          busy={busy === `${item.id}:${row.rowId}` || busy === 'bulk'}
          selecting={Boolean(selection)}
          selected={selectedRows.includes(row.rowId)}
          selectionLocked={selection?.kind === 'imports' && selection.ids.length > 0}
          onOpen={() => onOpen(row)}
          onSelect={() => onToggleRow(row.rowId)}
          onRequestDelete={(resetSwipe) => onRequestDeleteRow(row, resetSwipe)}
        />
      ))}
      {item.blockingIssues.length ? (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {item.blockingIssues.length} issue{item.blockingIssues.length === 1 ? '' : 's'} must be
          fixed before preparation.
        </Text>
      ) : null}
    </View>
  );
}

function EmployeeRow({
  row,
  colors,
  busy,
  selecting,
  selected,
  selectionLocked,
  onOpen,
  onSelect,
  onRequestDelete,
}: {
  row: Row;
  colors: Colors;
  busy: boolean;
  selecting: boolean;
  selected: boolean;
  selectionLocked: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onRequestDelete: (resetSwipe?: () => void) => void;
}) {
  const x = useSharedValue(0);
  const isThresholdPassed = useSharedValue(false);
  const ACTION_WIDTH = -76;
  const FULL_SWIPE_TRIGGER = -170;

  const handleTriggerDelete = () => {
    runOnJS(onRequestDelete)(() => {
      x.value = withSpring(0, { damping: 20, stiffness: 220 });
    });
  };

  const pan = Gesture.Pan()
    .enabled(!selecting && !busy && !selectionLocked)
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const rawX = event.translationX;
      if (rawX > 0) {
        // Resistance drag right
        x.value = rawX * 0.15;
      } else {
        // Dragging left with slight dampening beyond action width
        x.value = Math.max(rawX, -220);
      }

      if (x.value < ACTION_WIDTH && !isThresholdPassed.value) {
        isThresholdPassed.value = true;
        runOnJS(haptics.selection)();
      } else if (x.value >= ACTION_WIDTH && isThresholdPassed.value) {
        isThresholdPassed.value = false;
      }
    })
    .onEnd((event) => {
      const vx = event.velocityX;
      const tx = x.value;

      if (tx < FULL_SWIPE_TRIGGER || vx < -650) {
        // Full drag or fast left swipe triggers confirmation
        x.value = withSpring(ACTION_WIDTH, { damping: 20, stiffness: 220 });
        runOnJS(handleTriggerDelete)();
      } else if (tx < ACTION_WIDTH / 2 || vx < -250) {
        // Snap open to action button
        x.value = withSpring(ACTION_WIDTH, { damping: 20, stiffness: 220 });
      } else {
        // Spring back closed
        x.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => {
    const scale = interpolate(x.value, [ACTION_WIDTH, 0], [1, 0.75], Extrapolation.CLAMP);
    const opacity = interpolate(x.value, [ACTION_WIDTH / 2, 0], [1, 0], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      layout={LinearTransition.springify()}
      exiting={FadeOutLeft.duration(160)}
      style={styles.swipeFrame}
    >
      {/* Background delete action button */}
      {!selecting ? (
        <View style={styles.deleteRevealContainer}>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={`Delete ${row.employeeName ?? 'employee'}`}
            disabled={busy}
            onPress={() => {
              haptics.light();
              onRequestDelete(() => {
                x.value = withSpring(0, { damping: 20, stiffness: 220 });
              });
            }}
            style={[styles.deleteActionButton, { backgroundColor: colors.destructive }]}
          >
            <Animated.View style={[styles.deleteActionInner, deleteButtonStyle]}>
              <Icon
                name='remove'
                size={18}
                color='#ffffff'
              />
              <Text style={styles.deleteActionText}>Delete</Text>
            </Animated.View>
          </Pressable>
        </View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.employeeRow,
            {
              borderTopColor: colors.border,
              backgroundColor: selected ? colors.muted : colors.composer,
              opacity: selectionLocked ? 0.45 : 1,
            },
            animatedStyle,
          ]}
        >
          <Pressable
            disabled={busy || selectionLocked}
            onPress={() => (selecting ? onSelect() : onOpen())}
            onLongPress={onSelect}
            delayLongPress={280}
            style={styles.rowPress}
          >
            {selecting ? (
              <SelectionMark
                selected={selected}
                colors={colors}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
                <Text style={[styles.avatarText, { color: colors.foreground }]}>
                  {(row.employeeName ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.foreground }]}>
                {row.employeeName ?? 'Unnamed employee'}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {row.role || row.destinationType || 'Payroll employee'} · {row.currency ?? ''}{' '}
                {row.amount?.toLocaleString() ?? '—'}
              </Text>
            </View>
          </Pressable>

          {!selecting ? (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={`Delete ${row.employeeName ?? 'employee'}`}
              disabled={busy}
              onPress={() => {
                onRequestDelete(() => {
                  x.value = withSpring(0, { damping: 20, stiffness: 220 });
                });
              }}
              style={styles.deleteButton}
            >
              <Icon
                name='remove'
                size={17}
                color={colors.destructive}
              />
            </Pressable>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function SelectionMark({ selected, colors }: { selected: boolean; colors: Colors }) {
  const scale = useSharedValue(selected ? 1 : 0.88);
  useEffect(() => {
    scale.value = withSpring(selected ? 1 : 0.88, { damping: 16, stiffness: 260 });
  }, [scale, selected]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        styles.selectionMark,
        {
          borderColor: selected ? colors.foreground : colors.border,
          backgroundColor: selected ? colors.foreground : 'transparent',
        },
        style,
      ]}
    >
      {selected ? (
        <Icon
          name='check'
          size={14}
          color={colors.background}
        />
      ) : null}
    </Animated.View>
  );
}

function Editor({
  selected,
  colors,
  busy,
  onClose,
  onSave,
}: {
  selected: { importId: string; row: Row } | null;
  colors: Colors;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const row = selected?.row;
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (row) {
      setValues({
        employeeName: row.employeeName ?? '',
        employeeId: row.employeeId ?? '',
        role: row.role ?? '',
        amount: row.amount == null ? '' : String(row.amount),
        currency: row.currency ?? '',
        destinationType: row.destinationType ?? '',
        destination: row.destination ?? '',
        rail: row.rail ?? '',
        period: row.period ?? '',
        payDate: row.payDate ?? '',
        reference: row.reference ?? '',
      });
    }
  }, [row]);

  const fields: [string, string][] = [
    ['employeeName', 'Name'],
    ['employeeId', 'Employee ID'],
    ['role', 'Position'],
    ['amount', 'Amount'],
    ['currency', 'Currency'],
    ['destinationType', 'Destination type'],
    ['destination', 'Destination'],
    ['rail', 'Network / bank'],
    ['period', 'Pay period'],
    ['payDate', 'Pay date (YYYY-MM-DD)'],
    ['reference', 'Reference'],
  ];

  return (
    <SheetModal
      visible={Boolean(row)}
      onClose={onClose}
      keyboardAvoiding
      style={styles.sheet}
    >
      <View style={styles.sheetHeader}>
        <View>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Employee details</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            Edit imported payroll information
          </Text>
        </View>
        <Pressable onPress={onClose}>
          <Icon
            name='close-circle'
            size={22}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>
      {row ? (
        <View style={styles.form}>
          {fields.map(([key, label]) => (
            <TextInput
              key={key}
              value={values[key] ?? ''}
              onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
              placeholder={label}
              placeholderTextColor={colors.mutedForeground}
              keyboardType={key === 'amount' ? 'decimal-pad' : 'default'}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
          ))}
          <Pressable
            disabled={busy}
            onPress={() =>
              void onSave({
                ...values,
                amount: Number(values.amount),
                payDate: values.payDate || null,
              })
            }
            style={[
              styles.saveButton,
              { backgroundColor: colors.foreground, opacity: busy ? 0.6 : 1 },
            ]}
          >
            <Text style={{ color: colors.background }}>{busy ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </View>
      ) : null}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { gap: 10, paddingBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 25, fontWeight: '600' },
  subtitle: { fontSize: 14, lineHeight: 19, marginTop: 3 },
  selectButton: { minWidth: 54, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  selectLabel: { fontSize: 15, fontWeight: '600' },
  separator: { height: 12 },
  empty: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card, gap: 4 },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 4 },
  cardHeadingPress: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTotal: { alignItems: 'flex-end', gap: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  rowText: { flex: 1, minWidth: 0 },
  total: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  name: { fontSize: 15, fontWeight: '600' },
  error: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  employeeRow: {
    minHeight: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  selectionMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeFrame: { position: 'relative', overflow: 'hidden' },
  deleteRevealContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  deleteActionButton: {
    width: 76,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
  },
  deleteActionInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  deleteActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  selectAll: { minWidth: 38, minHeight: 24, alignItems: 'flex-end', justifyContent: 'center' },
  selectAllText: { fontSize: 12, fontWeight: '600' },
  btn: {
    minHeight: 44,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnLabel: { fontSize: 15, fontWeight: '600' },
  bulkBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    minHeight: 66,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bulkCount: { fontSize: 16, fontWeight: '700' },
  bulkMeta: { fontSize: 12, opacity: 0.7, marginTop: 1 },
  bulkDelete: {
    minWidth: 100,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkDeleteText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sheet: { paddingHorizontal: 20, paddingBottom: 28 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  form: { gap: 10 },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  saveButton: {
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
