import type { PayrollRun } from '@finora/shared';

import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { listPayrollRuns } from '@/lib/payroll-api';

import { PayrollRunCard } from './PayrollRunCard';

const RUNS_SHOWN = 5;

function runTitle(run: PayrollRun) {
  if (run.kind === 'single') return run.items[0]?.employeeName ?? 'Employee payment';
  return run.period ?? 'Payroll';
}

function runDetail(run: PayrollRun) {
  const date = run.executedAt
    ? new Date(run.executedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : '';
  const people = run.items.length;
  const who = run.kind === 'single' ? 'One-off payment' : `${people} ${people === 1 ? 'person' : 'people'}`;
  return [date, who, run.mode === 'demo' ? 'Demo' : null].filter(Boolean).join(' · ');
}

/** Paid payroll runs, newest first; tap one for its receipt. */
export function PayrollRunsSection() {
  const { getToken } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [open, setOpen] = useState<PayrollRun | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listPayrollRuns(getToken)
        .then((next) => {
          if (active) setRuns(next);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [getToken]),
  );

  if (runs.length === 0) return null;

  return (
    <View className='mt-2 gap-2'>
      <Text className='px-1 font-sans-semibold text-[13px] uppercase tracking-[0.4px] text-muted-foreground'>
        Paid
      </Text>
      <View
        className='rounded-[26px] border border-border bg-composer px-4 py-1'
        style={{ borderCurve: 'continuous' }}
      >
        {runs.slice(0, RUNS_SHOWN).map((run, index) => (
          <Fragment key={run.id}>
            {index > 0 ? <View className='h-px bg-border' /> : null}
            <Pressable
              accessibilityRole='button'
              onPress={() => {
                haptics.selection();
                setOpen(run);
              }}
              className='min-h-[56px] flex-row items-center gap-3 py-2.5 active:opacity-75'
            >
              <View className='min-w-0 flex-1 gap-0.5'>
                <Text
                  className='font-sans-semibold text-[15px] text-foreground'
                  numberOfLines={1}
                >
                  {runTitle(run)}
                </Text>
                <Text className='font-sans text-[13px] text-muted-foreground'>{runDetail(run)}</Text>
              </View>
              <Text className='font-sans-semibold text-[15px] tabular-nums text-foreground'>
                {formatPaymentAmount(run.total, run.currency)}
              </Text>
            </Pressable>
          </Fragment>
        ))}
      </View>

      <SheetModal
        visible={open !== null}
        onClose={() => setOpen(null)}
        style={{ maxHeight: '88%' }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {open ? <PayrollRunCard run={open} /> : null}
        </ScrollView>
      </SheetModal>
    </View>
  );
}
