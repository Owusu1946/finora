import { MockQrCode } from '@/components/chat/MockQrCode';
import { FinoraMark } from '@/components/ui/finora-mark';
import { ScrollView, View } from 'react-native';

import { CopyAddressRow, InfoBanner, PrimaryButton } from './primitives';
import { depositStyles as styles } from './styles';
import type { DepositPalette } from './types';

export function FinoraUserStep({
  colors,
  finoraTag,
  copied,
  onCopy,
  onShare,
}: {
  colors: DepositPalette;
  finoraTag: string;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}) {
  const tagLabel = `@${finoraTag}`;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.detailContent}
    >
      <View style={[styles.qrFrame, { backgroundColor: colors.muted }]}>
        <MockQrCode
          value={`finora:user:${tagLabel}`}
          size={200}
          centerLogo={<FinoraMark size={40} />}
        />
      </View>
      <CopyAddressRow
        label='Finora tag'
        value={tagLabel}
        copied={copied}
        colors={colors}
        onCopy={onCopy}
      />
      <InfoBanner
        colors={colors}
        body='Share your tag so another Finora user can send you money instantly — no bank details needed.'
      />
      <PrimaryButton
        label='Share'
        icon='share'
        colors={colors}
        onPress={onShare}
      />
    </ScrollView>
  );
}
