import type { PayrollImportRow, PayrollInspectionResponse } from '@finora/shared';

import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { PayrollRowEditor } from '@/components/payroll/PayrollRowEditor';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { getPayrollImport, updatePayrollRow } from '@/lib/payroll-api';

type ReviewState = {
  sourceName: string;
  rows: PayrollImportRow[];
  total: number;
  currency: string;
};

function blockingIssue(row: PayrollImportRow) {
  return row.issues.find((issue) => issue.blocking) ?? null;
}

/**
 * Review a payroll read from a file, image, or chat message. Flagged rows can
 * be fixed in place; once nothing is blocked, Finora can prepare it.
 */
function PayrollReviewCard({ importId, initial }: { importId: string; initial: ReviewState }) {
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const aui = useAui();
  const [review, setReview] = useState(initial);
  const [editing, setEditing] = useState<PayrollImportRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [asked, setAsked] = useState(false);

  // Rows may have been fixed since (here, on the Payroll screen, or in chat).
  useEffect(() => {
    let active = true;
    void getPayrollImport(getToken, importId)
      .then((latest) => {
        if (!active) return;
        setReview((current) => ({
          ...current,
          rows: latest.rows,
          total: latest.total,
          currency: latest.currency,
        }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [getToken, importId]);

  const flagged = review.rows.filter((row) => blockingIssue(row));

  const save = async (patch: Record<string, unknown>) => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await updatePayrollRow(importId, editing.rowId, patch, getToken);
      setReview((current) => ({
        ...current,
        rows: updated.rows,
        total: updated.total,
        currency: updated.currency,
      }));
      const row = updated.rows.find((candidate) => candidate.rowId === editing.rowId);
      haptics.success();
      // Close once the row is fixed; keep it open if something is still missing.
      setEditing(row && blockingIssue(row) ? row : null);
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't save", error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View
        className='my-1.5 w-full gap-2.5 border border-border bg-composer p-4'
        style={{ borderRadius: Radius.card, borderCurve: 'continuous' }}
      >
        <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
          {flagged.length > 0
            ? `${flagged.length} ${flagged.length === 1 ? 'row needs' : 'rows need'} fixing`
            : 'Payroll ready to prepare'}
        </Text>
        <Text className='font-sans-semibold text-[16px] text-foreground'>{review.sourceName}</Text>
        <View className='flex-row items-center justify-between'>
          <Text className='font-sans text-foreground'>
            {review.rows.length} {review.rows.length === 1 ? 'employee' : 'employees'}
          </Text>
          <Text className='font-sans-semibold tabular-nums text-foreground'>
            {formatPaymentAmount(review.total, review.currency)}
          </Text>
        </View>
        {review.rows.map((row) => {
          const issue = blockingIssue(row);
          return (
            <View
              key={row.rowId}
              className='flex-row items-center gap-3'
            >
              <View className='min-w-0 flex-1'>
                <Text
                  className='font-sans-medium text-foreground'
                  numberOfLines={1}
                >
                  {row.employeeName ?? 'Unnamed employee'}
                </Text>
                <Text
                  className={`font-sans text-[12px] ${issue ? 'text-destructive' : 'text-muted-foreground'}`}
                  numberOfLines={1}
                >
                  {issue?.message ?? row.citations[0]?.location ?? 'Imported row'}
                </Text>
              </View>
              {issue ? (
                <Pressable
                  accessibilityRole='button'
                  accessibilityLabel={`Fix ${row.employeeName ?? 'row'}`}
                  onPress={() => {
                    haptics.selection();
                    setEditing(row);
                  }}
                  className='min-h-[32px] items-center justify-center rounded-full bg-foreground px-3.5 active:opacity-80'
                >
                  <Text className='font-sans-semibold text-[13px] text-background'>Fix</Text>
                </Pressable>
              ) : (
                <Text className='font-sans-medium tabular-nums text-foreground'>
                  {formatPaymentAmount(row.amount ?? 0, row.currency ?? review.currency)}
                </Text>
              )}
            </View>
          );
        })}
        {flagged.length === 0 ? (
          asked ? (
            <Text className='font-sans text-[13px] text-muted-foreground'>Preparing payroll…</Text>
          ) : (
            <Pressable
              accessibilityRole='button'
              onPress={() => {
                haptics.selection();
                setAsked(true);
                aui.composer.setText('Everything looks right. Prepare this payroll.');
                aui.composer.send();
              }}
              className='mt-1 min-h-11 items-center justify-center rounded-full bg-foreground px-4 active:opacity-85'
            >
              <Text className='font-sans-semibold text-[15px] text-background'>Prepare payroll</Text>
            </Pressable>
          )
        ) : (
          <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
            Tap Fix on each flagged row, or tell Finora what to change.
          </Text>
        )}
      </View>
      <PayrollRowEditor
        selected={editing ? { importId, row: editing } : null}
        colors={colors}
        busy={saving}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </>
  );
}

function renderReview(loadingLabel: string) {
  return function PayrollReviewContent({
    result,
    status,
  }: {
    result?: PayrollInspectionResponse;
    status: { type: string };
  }) {
    const { colors } = useTheme();
    if (status.type === 'running' || !result) {
      return (
        <View
          className='my-1.5 min-h-[72px] w-full flex-row items-center justify-center gap-2.5 border border-border bg-composer p-4'
          style={{ borderRadius: Radius.card }}
        >
          <LoadingIcon color={colors.mutedForeground} />
          <Text className='font-sans-medium text-muted-foreground'>{loadingLabel}</Text>
        </View>
      );
    }
    if (!result.ok || !result.importId) {
      return (
        <View
          className='my-1.5 w-full gap-2.5 border border-border bg-composer p-4'
          style={{ borderRadius: Radius.card }}
        >
          <Text className='font-sans-semibold text-[16px] text-foreground'>
            Payroll couldn't be read
          </Text>
          <Text className='font-sans text-muted-foreground'>
            {result.errorCode === 'payroll_file_format_not_supported'
              ? 'Send a spreadsheet, CSV, Word file, PDF, or photo of the payroll.'
              : 'Check the file and try again, or type the employees in chat.'}
          </Text>
        </View>
      );
    }
    return (
      <PayrollReviewCard
        importId={result.importId}
        initial={{
          sourceName: result.sourceName ?? 'Payroll',
          rows: result.rows ?? [],
          total: result.totals?.total ?? 0,
          currency: result.totals?.currency ?? 'USD',
        }}
      />
    );
  };
}

export const InspectPayrollAttachmentToolUI = makeAssistantToolUI<
  { attachmentId: string },
  PayrollInspectionResponse
>({
  toolName: 'inspect_payroll_attachment',
  display: 'standalone',
  render: renderReview('Reading payroll…'),
});

export const DraftPayrollToolUI = makeAssistantToolUI<Record<string, unknown>, PayrollInspectionResponse>(
  {
    toolName: 'draft_payroll',
    display: 'standalone',
    render: renderReview('Building payroll…'),
  },
);
