import { useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
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
      <View className='flex-1 bg-background'>
        <View className='gap-2.5 px-5 pt-5'>
          <Text className='font-sans-semibold text-[25px] text-foreground'>Payroll</Text>
          <Text className='mt-[3px] font-sans text-sm leading-[19px] text-muted-foreground'>
            Payroll management is available on Business accounts.
          </Text>
        </View>
      </View>
    );
  }

  if (!imports) {
    return (
      <View className='flex-1 bg-background'>
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
    <View className='flex-1 bg-background'>
      <LegendList
        data={imports}
        estimatedItemSize={120}
        keyExtractor={(item) => item.id}
        recycleItems
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { padding: 20, paddingBottom: selection ? 116 + insets.bottom : 40 },
        ]}
        ListHeaderComponent={
          <View className='gap-2.5 pb-2.5'>
            <View className='flex-row items-start gap-3'>
              <View className='min-w-0 flex-1'>
                <Text className='font-sans-semibold text-[25px] text-foreground'>Payroll</Text>
                <Text className='mt-[3px] font-sans text-sm leading-[19px] text-muted-foreground'>
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
                  className='min-h-[38px] min-w-[54px] items-center justify-center'
                >
                  <Text className='font-sans-semibold text-[15px] text-foreground'>
                    {selection ? 'Done' : 'Select'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {error ? (
              <Text className='mt-2.5 font-sans text-[13px] leading-[18px] text-destructive'>
                {error}
              </Text>
            ) : null}
            {!selection ? (
              <Pressable
                onPress={() => {
                  haptics.selection();
                  router.push('/');
                  aui.composer.setText('Create a payroll from an attachment');
                }}
                className='mt-1 min-h-11 items-center justify-center rounded-[32px] bg-foreground'
              >
                <Text className='font-sans-semibold text-[15px] text-background'>
                  Create payroll in chat
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className='rounded-[26px] border border-border bg-composer p-4'>
            <Text className='text-muted-foreground'>
              No payroll imports yet. Attach a payroll file in chat to create one.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className='h-3' />}
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
          className='absolute left-5 right-5 min-h-[66px] flex-row items-center justify-between rounded-[26px] bg-foreground px-4'
          style={{
            bottom: Math.max(insets.bottom, 12),
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <View>
            <Text className='font-sans text-base font-bold text-background'>
              {selectionCount} selected
            </Text>
            <Text className='mt-px font-sans text-xs text-background opacity-70'>
              {selection.kind === 'imports' ? 'Payrolls' : 'Employees'}
            </Text>
          </View>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='Delete selected'
            disabled={busy === 'bulk'}
            onPress={confirmDeleteBulk}
            className='min-h-[42px] min-w-[100px] flex-row items-center justify-center gap-[7px] rounded-lg bg-destructive px-3.5'
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
                <Text className='font-sans text-sm font-bold text-white'>Delete</Text>
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
      className='gap-1 rounded-[26px] border bg-composer p-4'
      style={{
        borderColor: importSelected || selectedRows.length ? colors.foreground : colors.border,
      }}
    >
      <View className='mb-1 flex-row items-center gap-3'>
        <Pressable
          disabled={!selection}
          onPress={onToggleImport}
          className='min-w-0 flex-1 flex-row items-center gap-2.5'
        >
          {selection ? (
            <SelectionMark
              selected={importSelected}
              colors={colors}
            />
          ) : null}
          <View className='min-w-0 flex-1'>
            <Text
              className='font-sans text-base font-bold text-foreground'
              numberOfLines={1}
            >
              {item.sourceName}
            </Text>
            <Text className='font-sans text-[13px] text-muted-foreground'>
              {item.rows.length} employees · {item.status} · {item.period ?? 'Period not set'}
            </Text>
          </View>
        </Pressable>
        <View className='items-end gap-[3px]'>
          <Text className='font-sans text-base font-bold text-foreground'>
            {formatPaymentAmount(item.total, item.currency)}
          </Text>
          {selection?.kind === 'rows' && selection.importId === item.id ? (
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={
                allRowsSelected ? 'Clear employee selection' : 'Select all employees'
              }
              onPress={onToggleAllRows}
              className='min-h-6 min-w-[38px] items-end justify-center'
            >
              <Text className='font-sans-semibold text-xs text-muted-foreground'>
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
        <Text className='mt-2.5 font-sans text-[13px] leading-[18px] text-destructive'>
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
      className='relative overflow-hidden'
    >
      {/* Background delete action button */}
      {!selecting ? (
        <View className='absolute inset-0 flex-row items-center justify-end'>
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
            className='h-full w-[76px] items-center justify-center rounded-r-[26px] bg-destructive'
          >
            <Animated.View
              className='items-center justify-center gap-0.5'
              style={deleteButtonStyle}
            >
              <Icon
                name='remove'
                size={18}
                color='#ffffff'
              />
              <Text className='font-sans text-[11px] font-bold text-white'>Delete</Text>
            </Animated.View>
          </Pressable>
        </View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              borderTopColor: colors.border,
              backgroundColor: selected ? colors.muted : colors.composer,
              opacity: selectionLocked ? 0.45 : 1,
            },
            animatedStyle,
          ]}
          className='min-h-16 flex-row items-center gap-2.5 border-t px-1 py-2'
        >
          <Pressable
            disabled={busy || selectionLocked}
            onPress={() => (selecting ? onSelect() : onOpen())}
            onLongPress={onSelect}
            delayLongPress={280}
            className='flex-1 flex-row items-center gap-3'
          >
            {selecting ? (
              <SelectionMark
                selected={selected}
                colors={colors}
              />
            ) : (
              <View className='size-9 items-center justify-center rounded-full bg-muted'>
                <Text className='font-sans text-[15px] font-bold text-foreground'>
                  {(row.employeeName ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View className='min-w-0 flex-1'>
              <Text className='font-sans-semibold text-[15px] text-foreground'>
                {row.employeeName ?? 'Unnamed employee'}
              </Text>
              <Text className='font-sans text-[13px] text-muted-foreground'>
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
              className='size-[38px] items-center justify-center'
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
        {
          borderColor: selected ? colors.foreground : colors.border,
          backgroundColor: selected ? colors.foreground : 'transparent',
        },
        style,
      ]}
      className='size-6 items-center justify-center rounded-[7px] border-[1.5px]'
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
    >
      <View className='flex-row items-center justify-between px-5 pb-3.5'>
        <View>
          <Text className='font-sans text-xl font-bold text-foreground'>Employee details</Text>
          <Text className='font-sans text-[13px] text-muted-foreground'>
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
        <ScrollView
          className='shrink'
          contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingBottom: 28 }}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          {fields.map(([key, label]) => (
            <TextInput
              key={key}
              value={values[key] ?? ''}
              onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
              placeholder={label}
              placeholderTextColor={colors.mutedForeground}
              keyboardType={key === 'amount' ? 'decimal-pad' : 'default'}
              className='min-h-11 rounded-[10px] border border-border px-3 text-[15px] text-foreground'
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
            className='mt-1 min-h-[46px] items-center justify-center rounded-[32px] bg-foreground'
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            <Text className='text-background'>{busy ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </SheetModal>
  );
}
