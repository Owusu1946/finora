import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  RecurringPaymentCard,
  type RecurringDraft,
} from '@/components/chat/RecurringPaymentCard';
import type { RecurringFrequency } from '@/components/recurring/types';
import { useTheme } from '@/hooks/use-theme';

type PrepareRecurringArgs = {
  amount?: number;
  currency?: string;
  recipientName?: string;
  frequency?: RecurringFrequency;
  destinationKind?: RecurringDraft['destination']['kind'];
  destinationLabel?: string;
  destinationValue?: string;
  reference?: string;
};

type PrepareRecurringResult = {
  status?: 'active' | 'cancelled';
  recurringId?: string;
};

function asDraft(args: PrepareRecurringArgs): RecurringDraft {
  return {
    amount: typeof args.amount === 'number' ? args.amount : 0,
    currency: args.currency ?? 'USD',
    recipientName: args.recipientName ?? 'Recipient',
    frequency: args.frequency ?? 'monthly',
    destination: {
      kind: args.destinationKind ?? 'bank_account',
      label: args.destinationLabel ?? 'Bank account',
      value: args.destinationValue ?? '—',
    },
    reference: args.reference,
  };
}

export const PrepareRecurringToolUI = makeAssistantToolUI<
  PrepareRecurringArgs,
  PrepareRecurringResult
>({
  toolName: 'prepare_recurring',
  display: 'standalone',
  render: ({ args, status, addResult }) => {
    const { colors } = useTheme();
    const hasArgs = args != null && (args.amount != null || Boolean(args.recipientName));

    if (status.type === 'running' && !hasArgs) {
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
      <RecurringPaymentCard
        draft={asDraft(args ?? {})}
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
