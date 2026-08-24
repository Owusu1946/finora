import { Pressable, View } from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FUNDING_CURRENCIES } from '@/lib/send-corridors';

const AMOUNTS = [50, 100, 250, 500, 1000, 2500];

export function AmountFundingStep({
  step,
  total,
  amount,
  customAmount,
  payoutCurrency,
  fundingCurrency,
  onAmount,
  onCustomAmount,
  onFundingCurrency,
  onBack,
  onContinue,
}: {
  step: number;
  total: number;
  amount: number | null;
  customAmount: string;
  payoutCurrency: string;
  fundingCurrency: string;
  onAmount: (n: number | null) => void;
  onCustomAmount: (s: string) => void;
  onFundingCurrency: (c: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { colors } = useTheme();
  const parsedCustom = Number(customAmount.replace(/,/g, ''));
  const effective =
    amount ?? (Number.isFinite(parsedCustom) && parsedCustom > 0 ? parsedCustom : null);

  return (
    <View className='gap-3'>
      <WizardStepHeader
        step={step}
        total={total}
        title='Amount'
        subtitle={`Payout currency ${payoutCurrency} · choose funding wallet`}
      />
      <View className='flex-row flex-wrap gap-2'>
        {AMOUNTS.map((n) => (
          <WizardChip
            key={n}
            label={`${n}`}
            selected={amount === n}
            onPress={() => {
              onAmount(n);
              onCustomAmount('');
            }}
          />
        ))}
      </View>
      <TextInput
        value={customAmount}
        onChangeText={(t) => {
          onCustomAmount(t);
          onAmount(null);
        }}
        placeholder={`Custom amount (${payoutCurrency})`}
        placeholderTextColor={colors.mutedForeground}
        keyboardType='decimal-pad'
        className='font-sans-medium border px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
        style={[styles.input]}
      />
      <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase mt-1 text-muted-foreground'>
        Fund from
      </Text>
      <View className='flex-row flex-wrap gap-2'>
        {FUNDING_CURRENCIES.map((c) => (
          <WizardChip
            key={c}
            label={c}
            selected={fundingCurrency === c}
            onPress={() => onFundingCurrency(c)}
            leading={
              <CurrencyIcon
                currency={c}
                size={18}
              />
            }
          />
        ))}
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
          disabled={effective == null}
          onPress={() => {
            if (effective == null) return;
            if (amount == null) onAmount(effective);
            onContinue();
          }}
          className='flex-[1.4] min-h-[46px] items-center justify-center'
          style={({ pressed }) => [
            {
              backgroundColor: colors.foreground,
              opacity: effective == null ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text className='text-[16px] font-semibold text-background'>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = {
  input: {
    borderRadius: Radius.composer,
  },
  navBtn: {
    borderRadius: Radius.composer,
  },
  navBtnPrimary: {
    borderRadius: Radius.composer,
  },
};
