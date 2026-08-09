import { AppText as Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import {
  CRYPTO_DEPOSIT_NETWORKS,
  truncateAddress,
  type CryptoNetworkId,
} from '@/lib/crypto-networks';
import { haptics } from '@/lib/haptics';
import { MOMO_NETWORKS, type MomoNetworkId } from '@/lib/momo-networks';
import { Pressable, ScrollView, View } from 'react-native';

import { ChainIcon, MomoIcon } from './icons';
import { depositStyles as styles } from './styles';
import type { DepositPalette, DepositStep } from './types';

export function NetworkPickerSheet({
  step,
  colors,
  networkId,
  momoNetwork,
  onClose,
  onSelectCrypto,
  onSelectMomo,
}: {
  step: 'network_picker' | 'momo_network_picker';
  colors: DepositPalette;
  networkId: CryptoNetworkId;
  momoNetwork: MomoNetworkId;
  onClose: () => void;
  onSelectCrypto: (id: CryptoNetworkId) => void;
  onSelectMomo: (id: MomoNetworkId) => void;
}) {
  const isCrypto = step === 'network_picker';

  return (
    <View
      style={[
        styles.sheetContainer,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.handle} />
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
          {isCrypto ? 'Select wallet' : 'Select network'}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={[styles.closeBtn, { backgroundColor: colors.muted }]}
        >
          <Icon
            name='remove'
            size={16}
            color={colors.foreground}
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pickerList}
      >
        {isCrypto
          ? CRYPTO_DEPOSIT_NETWORKS.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  haptics.selection();
                  onSelectCrypto(n.id);
                }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  { backgroundColor: colors.muted, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <ChainIcon
                  id={n.id}
                  size={40}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{n.name}</Text>
                  <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>
                    {truncateAddress(n.address)}
                  </Text>
                </View>
                {networkId === n.id ? (
                  <Icon
                    name='check'
                    size={18}
                    color={colors.foreground}
                  />
                ) : null}
              </Pressable>
            ))
          : MOMO_NETWORKS.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  haptics.selection();
                  onSelectMomo(n.id);
                }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  { backgroundColor: colors.muted, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MomoIcon
                  id={n.id}
                  size={40}
                />
                <Text style={[styles.pickerTitle, { color: colors.foreground, flex: 1 }]}>
                  {n.name}
                </Text>
                {momoNetwork === n.id ? (
                  <Icon
                    name='check'
                    size={18}
                    color={colors.foreground}
                  />
                ) : null}
              </Pressable>
            ))}
      </ScrollView>
    </View>
  );
}

export function getPickerCloseStep(step: DepositStep): DepositStep {
  return step === 'network_picker' ? 'stablecoin' : 'momo';
}
