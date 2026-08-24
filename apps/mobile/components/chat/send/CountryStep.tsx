import { StyleSheet, View } from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { SEND_CORRIDORS } from '@/lib/send-corridors';

const POPULAR = ['GH', 'US', 'GB', 'DE', 'NG', 'KE'];

export function CountryStep({
  step,
  total,
  country,
  query,
  onQueryChange,
  onSelect,
  includeCrypto,
  onSelectCrypto,
}: {
  step: number;
  total: number;
  country: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (code: string) => void;
  includeCrypto?: boolean;
  onSelectCrypto?: () => void;
}) {
  const { colors } = useTheme();
  const q = query.trim().toLowerCase();
  const filtered = SEND_CORRIDORS.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.currency.toLowerCase().includes(q),
  );
  const popular = SEND_CORRIDORS.filter((c) => POPULAR.includes(c.code));

  return (
    <View style={styles.block}>
      <WizardStepHeader
        step={step}
        total={total}
        title='Where are you sending?'
        subtitle='Choose the destination country or crypto'
      />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder='Search countries'
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      />
      {!q ? (
        <>
          <Text style={[styles.section, { color: colors.mutedForeground }]}>Popular</Text>
          <View style={styles.chips}>
            {popular.map((c) => (
              <WizardChip
                key={c.code}
                label={`${c.name} · ${c.currency}`}
                selected={country === c.code}
                onPress={() => onSelect(c.code)}
                leading={
                  <CurrencyIcon
                    currency={c.currency}
                    size={18}
                  />
                }
              />
            ))}
            {includeCrypto ? (
              <WizardChip
                label='Crypto · USDT/USDC'
                selected={country === 'CRYPTO'}
                onPress={() => onSelectCrypto?.()}
                leading={
                  <CurrencyIcon
                    currency='USDT'
                    size={18}
                  />
                }
              />
            ) : null}
          </View>
        </>
      ) : null}
      <Text style={[styles.section, { color: colors.mutedForeground }]}>
        {q ? 'Results' : 'All corridors'}
      </Text>
      <View style={styles.chips}>
        {filtered.map((c) => (
          <WizardChip
            key={c.code}
            label={`${c.name} (${c.code})`}
            selected={country === c.code}
            onPress={() => onSelect(c.code)}
            subtle
            leading={
              <CurrencyIcon
                currency={c.currency}
                size={18}
              />
            }
          />
        ))}
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '500',
  },
});
