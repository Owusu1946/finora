import { Pressable, View } from 'react-native';

import { formatPaymentAmount } from '@/components/chat/PaymentConfirmationCard';
import { WizardStepHeader } from '@/components/chat/WizardChrome';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FxQuoteView = {
  from: string;
  to: string;
  rate: number;
  fee: number;
  convertedAmount: number;
};

export function FxQuoteStep({
  step,
  total,
  amount,
  quote,
  onBack,
  onContinue,
}: {
  step: number;
  total: number;
  amount: number;
  quote: FxQuoteView;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View className='gap-3'>
      <WizardStepHeader
        step={step}
        total={total}
        title='FX quote'
        subtitle='Indicative rate · finalised at settlement'
      />
      <View
        className='border p-4 gap-3 bg-background border-border'
        style={[styles.card]}
      >
        <Row
          label='You send'
          value={formatPaymentAmount(amount, quote.from)}
        />
        <Row
          label='Fee'
          value={formatPaymentAmount(quote.fee, quote.from)}
        />
        <Row
          label='Rate'
          value={`1 ${quote.from} = ${quote.rate} ${quote.to}`}
        />
        <Row
          label='Recipient gets'
          value={formatPaymentAmount(quote.convertedAmount, quote.to)}
          emphasize
        />
      </View>
      <View className='flex-row gap-2.5 mt-1'>
        <Pressable
          onPress={onBack}
          className='flex-1 min-h-[46px] items-center justify-center rounded-full bg-muted px-4 active:opacity-75'
          style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
        >
          <Text className='font-sans-semibold text-[16px] tracking-[-0.2px] text-foreground'>
            Back
          </Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          className='flex-[1.4] min-h-[46px] items-center justify-center rounded-full px-4 bg-primary active:opacity-85 disabled:opacity-40'
          style={({ pressed }) => [
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={{ color: colors.primaryForeground }}
            className='font-sans-semibold text-[16px] tracking-[-0.2px] text-primary-foreground'
          >
            Review payment
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View className='flex-row justify-between items-center gap-3'>
      <Text className='font-sans-medium text-[13px] text-muted-foreground'>{label}</Text>
      <Text
        className={
          emphasize
            ? 'font-sans-semibold text-[17px] tracking-[-0.3px] tabular-nums text-foreground'
            : 'font-sans-semibold text-[16px] tracking-[-0.2px] tabular-nums text-foreground'
        }
      >
        {value}
      </Text>
    </View>
  );
}

const styles = {
  card: {
    borderRadius: Radius.lg,
  },
};
