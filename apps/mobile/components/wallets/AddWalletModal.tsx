import React from 'react';
import { StyleSheet, Text, View, Pressable, Modal } from 'react-native';

import { CurrencyIcon, SupportedCurrency } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

interface AddWalletModalProps {
  visible: boolean;
  onClose: () => void;
}

interface CurrencyOption {
  code: SupportedCurrency;
  name: string;
}

export function AddWalletModal({ visible, onClose }: AddWalletModalProps) {
  const { colors } = useTheme();

  const options: CurrencyOption[] = [
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'KES', name: 'Kenyan Shilling' },
  ];

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Add Currency Wallet
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
            >
              <Icon
                name='remove'
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            {options.map((item) => (
              <Pressable
                key={item.code}
                onPress={() => {
                  haptics.selection();
                  onClose();
                }}
                style={[styles.addOptionRow, { backgroundColor: colors.muted }]}
              >
                <CurrencyIcon
                  currency={item.code}
                  size={30}
                />
                <Text style={[styles.addOptionText, { color: colors.foreground }]}>
                  {item.code} • {item.name}
                </Text>
                <Icon
                  name='add'
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  addOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
  },
  addOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
