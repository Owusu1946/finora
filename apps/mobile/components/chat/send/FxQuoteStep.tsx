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
        className='border p-3.5 gap-2.5 bg-background border-border'
        style={[styles.card]}
      >
        <Row
          label='You send'
          value={formatPaymentAmount(amount, quote.from)}
          colors={colors}
        />
        <Row
          label='Fee'
          value={formatPaymentAmount(quote.fee, quote.from)}
          colors={colors}
        />
        <Row
          label='Rate'
          value={`1 ${quote.from} = ${quote.rate} ${quote.to}`}
          colors={colors}
        />
        <Row
          label='Recipient gets'
          value={formatPaymentAmount(quote.convertedAmount, quote.to)}
          colors={colors}
          emphasize
        />
      </View>
      <View className='flex-row gap-2.5 mt-1'>
        <Pressable
          onPress={onBack}
          className='flex-1 min-h-[46px] border items-center justify-center'
          style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text className='text-[16px] font-semibold text-foreground'>Back</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          className='flex-[1.4] min-h-[46px] items-center justify-center'
          style={({ pressed }) => [
            {
              backgroundColor: colors.foreground,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text className='text-[16px] font-semibold text-background'>Review payment</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  colors: _colors,
  emphasize,
}: {
  label: string;
  value: string;
  colors: { mutedForeground: string; foreground: string };
  emphasize?: boolean;
}) {
  return (
    <View className='flex-row justify-between items-center gap-3'>
      <Text className='text-[14px] font-medium text-muted-foreground'>{label}</Text>
      <Text
        className='text-[15px] tracking-[-0.2px] text-foreground'
        style={[
          {
            fontWeight: emphasize ? '700' : '600',
            fontFamily: 'DMSans_400Regular',
            fontSize: emphasize ? 17 : 14,
          },
        ]}
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
  navBtn: {
    borderRadius: Radius.composer,
  },
  navBtnPrimary: {
    borderRadius: Radius.composer,
  },
};
