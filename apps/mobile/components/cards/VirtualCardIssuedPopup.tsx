import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import type { VirtualCard } from '@/components/cards/types';

import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
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
      <View style={styles.backdrop}>
        {card ? (
          <View style={[styles.popup, { backgroundColor: colors.background }]}>
            <View style={styles.copy}>
              <View style={[styles.successIcon, { backgroundColor: colors.foreground }]}>
                <Icon
                  name='check'
                  size={24}
                  color={colors.background}
                />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>Card ready</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
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
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.foreground, opacity: pressed ? 0.76 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.background }]}>View cards</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  popup: {
    borderRadius: Radius.card,
    padding: 20,
    gap: 18,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  copy: { alignItems: 'center', gap: 8 },
  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'DMSans_600SemiBold', fontSize: 24, letterSpacing: -0.5 },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: {
    borderRadius: Radius.pill,
    minHeight: 54,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 16 },
});
