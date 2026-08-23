import React from 'react';
import { Pressable, View } from 'react-native';

import { CurrencyIcon, SupportedCurrency } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text } from '@/components/ui/text';
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
    <SheetModal
      visible={visible}
      onClose={onClose}
      style={{ paddingHorizontal: 20, gap: 16 }}
    >
      <View className='flex-row items-center justify-between'>
        <Text className='font-sans-semibold text-lg text-foreground'>Add Currency Wallet</Text>
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

      <View className='gap-2'>
        {options.map((item) => (
          <Pressable
            key={item.code}
            onPress={() => {
              haptics.selection();
              onClose();
            }}
            className='flex-row items-center gap-3 rounded-xl bg-muted p-3'
          >
            <CurrencyIcon
              currency={item.code}
              size={30}
            />
            <Text className='flex-1 font-sans-semibold text-[15px] text-foreground'>
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
    </SheetModal>
  );
}
