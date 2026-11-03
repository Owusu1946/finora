import type { SpendingSummary } from '@finora/shared';

import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Result = {
  summary?: SpendingSummary;
  previous?: { label: string; outflow: number };
};

/** Where the money went in a period: total out, then each category as a bar. */
export const SpendingSummaryToolUI = makeAssistantToolUI<{ period?: string }, Result>({
  toolName: 'summarize_spending',
  display: 'standalone',
  render: function SpendingSummaryToolContent({ result, status }) {
    const { colors } = useTheme();
    const summary = result?.summary;

    if (!summary) {
      return status.type === 'running' ? (
        <View
          className='my-2 min-h-[72px] border items-center justify-center border-border bg-composer'
          style={styles.card}
        >
          <LoadingIcon color={colors.mutedForeground} />
        </View>
      ) : null;
    }

    const previous = result?.previous;
    return (
      <View
        className='my-1.5 border p-4 gap-3.5 border-border bg-composer'
        style={styles.card}
      >
        <View className='gap-0.5'>
          <Text className='font-sans-semibold text-[12px] text-muted-foreground'>
            Spending · {summary.label}
          </Text>
          <Text className='font-sans-semibold text-[27px] tracking-[-0.6px] tabular-nums text-foreground'>
            {formatPaymentAmount(summary.outflow, summary.currency)}
          </Text>
          {previous ? (
            <Text className='font-sans-medium text-[13px] text-muted-foreground'>
              {previous.label}: {formatPaymentAmount(previous.outflow, summary.currency)}
            </Text>
          ) : null}
        </View>

        {summary.byCategory.length ? (
          <View className='gap-2.5'>
            {summary.byCategory.slice(0, 6).map((item) => (
              <View
                key={item.category}
                className='gap-1'
              >
                <View className='flex-row justify-between'>
                  <Text className='font-sans-medium text-[14px] text-foreground'>
                    {item.category}
                  </Text>
                  <Text className='font-sans-medium text-[14px] tabular-nums text-foreground'>
                    {formatPaymentAmount(item.amount, summary.currency)}
                  </Text>
                </View>
                <View className='h-1.5 rounded-full bg-muted overflow-hidden'>
                  <View
                    className='h-1.5 rounded-full bg-foreground'
                    style={{ width: `${Math.max(2, Math.round(item.share * 100))}%` }}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text className='font-sans-medium text-[14px] text-muted-foreground'>
            No money went out in this period.
          </Text>
        )}

        <Text className='font-sans-medium text-[12px] text-muted-foreground'>
          In {summary.currency} at demo rates.
        </Text>
      </View>
    );
  },
});

const styles = {
  card: { borderRadius: Radius.card },
};
