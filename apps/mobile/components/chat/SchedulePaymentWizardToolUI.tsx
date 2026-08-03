import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  SchedulePaymentWizard,
  type ScheduleWizardSeed,
} from '@/components/chat/SchedulePaymentWizard';
import type { RecurringFrequency } from '@/components/recurring/types';
import { useTheme } from '@/hooks/use-theme';

type ScheduleWizardArgs = ScheduleWizardSeed & {
  frequency?: RecurringFrequency;
};

type ScheduleWizardResult = {
  status?: 'active' | 'cancelled';
  recurringId?: string;
};

export const SchedulePaymentWizardToolUI = makeAssistantToolUI<
  ScheduleWizardArgs,
  ScheduleWizardResult
>({
  toolName: 'schedule_payment_wizard',
  display: 'standalone',
  render: ({ args, status, addResult }) => {
    const { colors } = useTheme();

    if (status.type === 'running' && args == null) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      );
    }

    return (
      <SchedulePaymentWizard
        seed={args ?? {}}
        onCreated={(payment) => {
          addResult({ status: 'active', recurringId: payment.id });
        }}
        onCancelled={() => {
          addResult({ status: 'cancelled' });
        }}
      />
    );
  },
});

const styles = StyleSheet.create({
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
