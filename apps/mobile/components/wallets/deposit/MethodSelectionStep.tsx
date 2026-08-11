import { Pressable, View } from 'react-native';

import { CurrencyIcon } from '@/components/ui/currency-icon';
import { FinoraMark } from '@/components/ui/finora-mark';
import { AirtelTigoLogo, MtnLogo, TelecelLogo } from '@/components/ui/momo-logos';
import { AppText as Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';

import type { DepositMethodId, DepositPalette, DepositStep } from './types';

import { IconStack, MetaRow } from './primitives';
import { depositStyles as styles } from './styles';

type MethodOption = {
  id: DepositMethodId;
  title: string;
  eta: string;
  fee?: string;
  icons: React.ReactNode;
  next: DepositStep;
};

const METHODS: MethodOption[] = [
  {
    id: 'finora_user',
    title: 'Finora user',
    eta: 'Instant',
    fee: 'Free',
    icons: <FinoraMark size={40} />,
    next: 'finora_user',
  },
  {
    id: 'stablecoin',
    title: 'Stablecoin wallet',
    eta: '1 - 2 mins',
    icons: (
      <IconStack>
        {[
          <CurrencyIcon
            key='usdt'
            currency='USDT'
            size={34}
          />,
          <CurrencyIcon
            key='usdc'
            currency='USDC'
            size={34}
          />,
        ]}
      </IconStack>
    ),
    next: 'stablecoin',
  },
  {
    id: 'mobile_money',
    title: 'Mobile money',
    eta: 'Instant',
    icons: (
      <IconStack>
        {[
          <MtnLogo
            key='mtn'
            size={34}
          />,
          <TelecelLogo
            key='telecel'
            size={34}
          />,
          <AirtelTigoLogo
            key='at'
            size={34}
          />,
        ]}
      </IconStack>
    ),
    next: 'momo',
  },
];

export function MethodSelectionStep({
  colors,
  onSelect,
}: {
  colors: DepositPalette;
  onSelect: (step: DepositStep) => void;
}) {
  return (
    <View style={styles.methodList}>
      {METHODS.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => {
            haptics.selection();
            onSelect(m.next);
          }}
          style={({ pressed }) => [
            styles.methodCard,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.methodTitle, { color: colors.foreground }]}>{m.title}</Text>
            <MetaRow
              eta={m.eta}
              fee={m.fee}
              muted={colors.mutedForeground}
            />
          </View>
          {m.icons}
        </Pressable>
      ))}
    </View>
  );
}
