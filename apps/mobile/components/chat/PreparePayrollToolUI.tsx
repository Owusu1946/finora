import type { PayrollRun } from '@finora/shared';

import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { PayrollRunCard } from '@/components/payroll/PayrollRunCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PayrollRunResult = { ok?: boolean; run?: PayrollRun; errorCode?: string };

function Preparing({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View
      className='my-2 min-h-[72px] items-center justify-center gap-2 border border-border bg-composer p-4'
      style={{ borderRadius: Radius.card }}
    >
      <LoadingIcon color={colors.mutedForeground} />
      <Text className='font-sans-medium text-[14px] text-muted-foreground'>{label}</Text>
    </View>
  );
}

function renderRun(label: string) {
  return function PayrollRunToolContent({
    result,
    status,
  }: {
    result?: PayrollRunResult;
    status: { type: string };
  }) {
    if (status.type === 'running' && !result) return <Preparing label={label} />;
    // Failures (blocked import, mixed currencies) are explained by Finora in text.
    if (!result?.ok || !result.run) return null;
    return <PayrollRunCard run={result.run} />;
  };
}

export const PreparePayrollToolUI = makeAssistantToolUI<Record<string, unknown>, PayrollRunResult>(
  {
    toolName: 'prepare_payroll',
    display: 'standalone',
    render: renderRun('Preparing payroll…'),
  },
);

export const PrepareEmployeePaymentToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  PayrollRunResult
>({
  toolName: 'prepare_employee_payment',
  display: 'standalone',
  render: renderRun('Preparing the payment…'),
});
