import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
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
    <View style={styles.block}>
      <WizardStepHeader
        step={step}
        total={total}
        title='Amount'
        subtitle={`Payout currency ${payoutCurrency} · choose funding wallet`}
      />
      <View style={styles.chips}>
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
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      />
      <Text style={[styles.section, { color: colors.mutedForeground }]}>Fund from</Text>
      <View style={styles.chips}>
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
      <View style={styles.nav}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.navBtn,
            { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.navLabel, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Pressable
          disabled={effective == null}
          onPress={() => {
            if (effective == null) return;
            if (amount == null) onAmount(effective);
            onContinue();
          }}
          style={({ pressed }) => [
            styles.navBtnPrimary,
            {
              backgroundColor: colors.foreground,
              opacity: effective == null ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.navLabelPrimary, { color: colors.background }]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
  },
  nav: { flexDirection: 'row', gap: 10, marginTop: 4 },
  navBtn: {
    flex: 1,
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPrimary: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { fontSize: 16, fontWeight: '600' },
  navLabelPrimary: { fontSize: 16, fontWeight: '600' },
});
