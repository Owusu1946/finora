import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { subscribeVirtualCardIssuance } from '@/lib/virtual-cards-storage';

export function VirtualCardIssuedPopup() {
  const { colors } = useTheme();
  const router = useRouter();
  const [card, setCard] = useState<VirtualCard | null>(null);

  useEffect(() => subscribeVirtualCardIssuance(setCard), []);

  return (
    <Modal
      visible={card !== null}
      transparent
      animationType='fade'
      onRequestClose={() => setCard(null)}
    >
      <View className='flex-1 justify-center bg-black/[0.52] p-5'>
        {card ? (
          <View className='w-full max-w-[440px] gap-[18px] self-center rounded-2xl bg-background p-5'>
            <View className='items-center gap-2'>
              <View className='h-[52px] w-[52px] items-center justify-center rounded-full bg-foreground'>
                <Icon
                  name='check'
                  size={24}
                  color={colors.background}
                />
              </View>
              <Text className='font-sans-semibold text-2xl text-foreground'>Card ready</Text>
              <Text className='text-center font-sans text-[15px] leading-[21px] text-muted-foreground'>
                Your {card.label.toLowerCase()} card is ready. Open Cards to reveal its details.
              </Text>
            </View>
            <VirtualCardFace
              card={card}
              appear
              tilt={false}
            />
            <Pressable
              onPress={() => {
                haptics.selection();
                setCard(null);
                router.push('/cards' as Href);
              }}
              className='min-h-[54px] items-center justify-center rounded-full bg-foreground px-[18px] active:opacity-75'
            >
              <Text className='font-sans-semibold text-base text-background'>View cards</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
