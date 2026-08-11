import { Pressable, ScrollView, View } from 'react-native';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { CurrencyIcon } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';

import type { DepositPalette } from './types';

import { ChainIcon } from './icons';
import { CopyAddressRow, InfoBanner, PrimaryButton } from './primitives';
import { depositStyles as styles } from './styles';

export function StablecoinStep({
  colors,
  asset,
  network,
  copied,
  onAssetChange,
  onOpenNetworkPicker,
  onCopy,
  onShare,
}: {
  colors: DepositPalette;
  asset: 'USDT' | 'USDC';
  network: { id: import('@/lib/crypto-networks').CryptoNetworkId; name: string; address: string };
  copied: boolean;
  onAssetChange: (asset: 'USDT' | 'USDC') => void;
  onOpenNetworkPicker: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.detailContent}
    >
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Asset</Text>
      <View style={styles.assetRow}>
        {(['USDT', 'USDC'] as const).map((a) => (
          <Pressable
            key={a}
            onPress={() => {
              haptics.selection();
              onAssetChange(a);
            }}
            style={({ pressed }) => [
              styles.assetChip,
              {
                backgroundColor: asset === a ? colors.foreground : colors.muted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <CurrencyIcon
              currency={a}
              size={18}
            />
            <Text
              style={{
                color: asset === a ? colors.background : colors.foreground,
                fontWeight: '600',
                fontSize: 14,
              }}
            >
              {a}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Network</Text>
      <Pressable
        onPress={() => {
          haptics.selection();
          onOpenNetworkPicker();
        }}
        style={[styles.selectField, { backgroundColor: colors.muted }]}
      >
        <View style={styles.selectLeft}>
          <ChainIcon
            id={network.id}
            size={28}
          />
          <Text style={[styles.selectValue, { color: colors.foreground }]}>{network.name}</Text>
        </View>
        <Icon
          name='chevron-down'
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>

      <View style={[styles.qrFrame, { backgroundColor: colors.muted }]}>
        <MockQrCode
          value={network.address}
          size={220}
          centerLogo={
            <CurrencyIcon
              currency={asset}
              size={44}
            />
          }
          centerLogoSize={44}
        />
      </View>

      <CopyAddressRow
        label='Wallet address'
        value={network.address}
        copied={copied}
        colors={colors}
        mono
        onCopy={onCopy}
      />

      <InfoBanner
        colors={colors}
        title='Important'
        body='Please make sure that the selected network matches the network of the platform you’re receiving crypto from to avoid loss of funds.'
        tone='info'
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
