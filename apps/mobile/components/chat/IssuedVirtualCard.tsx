import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatCardAmount, type VirtualCard } from '@/components/cards/types';
import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import { AppText as Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { getVirtualCard, subscribeVirtualCards } from '@/lib/virtual-cards-storage';

/** A card copy that is safe to keep in chat history and send to the model. */
export function cardForChat(card: VirtualCard): VirtualCard {
  return { ...card, pan: '', cvv: '', expiry: '' };
}

/**
 * The issued card, rendered in the chat. Starts from the masked copy stored in
 * the message and refreshes its live status and spend from the API.
 */
export function IssuedVirtualCard({ card: initial }: { card: VirtualCard }) {
  const router = useRouter();
  const [card, setCard] = useState(() => cardForChat(initial));

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void getVirtualCard(initial.id).then((live) => {
        if (alive && live) setCard(cardForChat(live));
      });
    refresh();
    const unsubscribe = subscribeVirtualCards(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [initial.id]);

  const status =
    card.status === 'cancelled' ? 'Cancelled' : card.status === 'frozen' ? 'Frozen' : null;

  return (
    <View className='my-2.5 w-full gap-3'>
      <View className='gap-0.5 px-1'>
        <Text className='font-sans-semibold text-[18px] tracking-[-0.3px] text-foreground'>
          {status ? `${card.label} card · ${status}` : `${card.label} card ready`}
        </Text>
        <Text className='font-sans-medium text-[14px] leading-[20px] text-muted-foreground'>
          {formatCardAmount(card.spendLimit, 'USD')} loaded · •••• {card.last4}
        </Text>
      </View>
      <VirtualCardFace
        card={card}
        appear
        tilt={false}
      />
      <Pressable
        accessibilityRole='button'
        onPress={() => {
          haptics.selection();
          router.push(`/card/${card.id}` as Href);
        }}
        className='min-h-[48px] items-center justify-center rounded-full bg-foreground px-[18px] active:opacity-75'
      >
        <Text className='font-sans-semibold text-[15px] text-background'>View card</Text>
      </Pressable>
    </View>
  );
}
