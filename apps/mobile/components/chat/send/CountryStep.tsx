import { View } from 'react-native';

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
    <View className='gap-3'>
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
        className='font-sans-medium border rounded-[12px] px-3 py-2.5 text-[16px] text-foreground border-border bg-background'
      />
      {!q ? (
        <>
          <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase mt-1 text-muted-foreground'>
            Popular
          </Text>
          <View className='flex-row flex-wrap gap-2'>
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
      <Text className='font-sans-semibold text-[12px] tracking-[0.3px] uppercase mt-1 text-muted-foreground'>
        {q ? 'Results' : 'All corridors'}
      </Text>
      <View className='flex-row flex-wrap gap-2'>
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
