import { MockQrCode } from '@/components/chat/MockQrCode';
import { FinoraMark } from '@/components/ui/finora-mark';
import { ScrollView, View } from 'react-native';

import {
  CopyAddressRow,
  InfoBanner,
  PrimaryButton,
} from './primitives';
import { depositStyles as styles } from './styles';
import type { DepositPalette } from './types';

const FINORA_TAG = '@kenneth';

export function FinoraUserStep({
  colors,
  copied,
  onCopy,
  onShare,
}: {
  colors: DepositPalette;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.detailContent}
    >
      <View style={[styles.qrFrame, { backgroundColor: colors.muted }]}>
        <MockQrCode
          value='finora:user:@kenneth'
          size={200}
          centerLogo={<FinoraMark size={40} />}
        />
      </View>
      <CopyAddressRow
        label='Finora tag'
        value={FINORA_TAG}
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
