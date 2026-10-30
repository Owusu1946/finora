import type { PayrollImportRow } from '@finora/shared';

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';

/** Edits one imported payroll employee; used by the Payroll screen and chat. */
export function PayrollRowEditor({
  selected,
  colors,
  busy,
  onClose,
  onSave,
}: {
  selected: { importId: string; row: PayrollImportRow } | null;
  colors: ReturnType<typeof useTheme>['colors'];
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
            className='mt-1 min-h-[46px] items-center justify-center rounded-full bg-foreground'
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            <Text className='text-background'>{busy ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </SheetModal>
  );
}
