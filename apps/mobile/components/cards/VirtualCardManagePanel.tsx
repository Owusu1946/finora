import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { CardTopUpSheet, type CardTopUpChoice } from '@/components/cards/CardTopUpSheet';
import {
  formatCardAmount,
  formatPanGrouped,
  remainingLimit,
  type VirtualCard,
} from '@/components/cards/types';
import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { topUpCard } from '@/lib/card-funding';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { setVirtualCardStatus } from '@/lib/virtual-cards-storage';

const REVEAL_MS = 30_000;

export function VirtualCardManagePanel({
  card: initial,
  compactFace,
  onChanged,
}: {
  card: VirtualCard;
  compactFace?: boolean;
  onChanged?: (card: VirtualCard) => void;
}) {
  const { colors } = useTheme();
  const { requestApproval, modal } = usePasscodeApproval();
  const [card, setCard] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [revealUntil, setRevealUntil] = useState<number | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  // Set when the top-up sheet confirms; runs once the sheet has fully closed.
  const pendingTopUpRef = useRef<CardTopUpChoice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCard(initial);
  }, [initial]);

  useEffect(() => {
    if (!revealUntil) return;
    const left = revealUntil - Date.now();
    if (left <= 0) {
      setRevealed(false);
      setCardSide('front');
      setRevealUntil(null);
      return;
    }
    const t = setTimeout(() => {
      setRevealed(false);
      setCardSide('front');
      setRevealUntil(null);
    }, left);
    return () => clearTimeout(t);
  }, [revealUntil]);

  const apply = (next: VirtualCard) => {
    setCard(next);
    onChanged?.(next);
  };

  const reveal = async () => {
    if (busy || card.status === 'cancelled') return false;
    setBusy(true);
    const ok = await requestApproval();
    setBusy(false);
    if (!ok) return false;
    haptics.success();
    setRevealed(true);
    setRevealUntil(Date.now() + REVEAL_MS);
    return true;
  };

  const flipCard = async () => {
    if (busy || card.status === 'cancelled') return;
    if (cardSide === 'back') {
      haptics.selection();
      setCardSide('front');
      return;
    }

    if (!revealed) {
      const approved = await reveal();
      if (!approved) return;
    }

    haptics.selection();
    setCardSide('back');
  };

  const toggleFreeze = async () => {
    if (card.status === 'cancelled' || busy) return;
    setBusy(true);
    const nextStatus = card.status === 'frozen' ? 'active' : 'frozen';
    const next = await setVirtualCardStatus(card.id, nextStatus);
    setBusy(false);
    if (!next) return;
    haptics.selection();
    apply(next);
  };

  // Confirm with the passcode, then add to the card and charge the chosen account.
  const runTopUp = async (choice: CardTopUpChoice) => {
    if (busy || card.status === 'cancelled') return;
    setBusy(true);
    try {
      const ok = await requestApproval();
      if (!ok) return;
      const next = await topUpCard({
        card,
        amountUsd: choice.amountUsd,
        walletId: choice.walletId,
      });
      haptics.success();
      apply(next);
    } catch (error) {
      haptics.error();
      Alert.alert(
        "Couldn't top up card",
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelCard = () => {
    if (card.status === 'cancelled') return;
    Alert.alert('Cancel card?', 'This card will stop working immediately.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel card',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const next = await setVirtualCardStatus(card.id, 'cancelled');
            setBusy(false);
            if (!next) return;
            haptics.impact();
            setRevealed(false);
            setCardSide('front');
            apply(next);
          })();
        },
      },
    ]);
  };

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    haptics.success();
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  return (
    <View className='gap-3'>
      <VirtualCardFace
        card={card}
        compact={compactFace}
        tilt
        revealed={revealed}
        side={cardSide}
        onFlipGesture={() => void flipCard()}
      />

      <Text className='mb-0.5 mt-3 font-sans-semibold text-xl text-foreground'>Spending</Text>
      <View className='flex-row gap-2 rounded-[26px] border border-border bg-composer p-4 shadow'>
        <Stat
          label='Spent'
          value={formatCardAmount(card.spent, card.currency)}
        />
        <Stat
          label='Remaining'
          value={formatCardAmount(remainingLimit(card), card.currency)}
        />
        <Stat
          label='Loaded'
          value={formatCardAmount(card.spendLimit, card.currency)}
        />
      </View>

      <Text className='mb-0.5 mt-3 font-sans-semibold text-xl text-foreground'>Card details</Text>
      <View className='flex-col gap-2.5 rounded-[26px] border border-border bg-composer p-4 shadow'>
        <View className='flex-row flex-wrap items-center justify-between gap-2.5'>
          <Text className='font-sans-medium text-sm text-muted-foreground'>
            Number · expiry · CVV
          </Text>
          <View className='flex-row items-center gap-2'>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={cardSide === 'back' ? 'Show front of card' : 'Show back of card'}
              onPress={() => void flipCard()}
              disabled={busy || card.status === 'cancelled'}
              className='flex-row items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5'
              style={({ pressed }) => ({
                opacity: pressed || card.status === 'cancelled' ? 0.6 : 1,
              })}
            >
              <Icon
                name='card'
                size={14}
                color={colors.foreground}
              />
              <Text className='font-sans-medium text-[13px] text-foreground'>
                {cardSide === 'back' ? 'Show front' : 'Show back'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={revealed ? 'Card details visible' : 'Reveal card details'}
              onPress={() => void reveal()}
              disabled={busy || card.status === 'cancelled' || revealed}
              className='flex-row items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5'
              style={({ pressed }) => ({
                opacity: pressed || card.status === 'cancelled' ? 0.6 : 1,
              })}
            >
              <Icon
                name={revealed ? 'eye' : 'eye-off'}
                size={14}
                color={colors.foreground}
              />
              <Text className='font-sans-medium text-[13px] text-foreground'>
                {revealed ? 'Visible' : 'Reveal'}
              </Text>
            </Pressable>
          </View>
        </View>

        {revealed ? (
          <View className='gap-2.5'>
            <SecretRow
              label='Number'
              value={formatPanGrouped(card.pan)}
              onCopy={() => void copy(card.pan, 'Card number')}
            />
            <SecretRow
              label='Expiry'
              value={card.expiry}
              onCopy={() => void copy(card.expiry, 'Expiry')}
            />
            <SecretRow
              label='CVV'
              value={card.cvv}
              onCopy={() => void copy(card.cvv, 'CVV')}
            />
            <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
              Details hide automatically after 30 seconds.
            </Text>
          </View>
        ) : (
          <Text className='font-sans text-[13px] leading-[18px] text-muted-foreground'>
            Turn your wrist or use Show back. Passcode required before details appear.
          </Text>
        )}
      </View>

      <View className='gap-2'>
        {card.status !== 'cancelled' ? (
          <ActionButton
            label='Top up'
            onPress={() => setTopUpOpen(true)}
          />
        ) : null}
        {card.status !== 'cancelled' ? (
          <ActionButton
            label={card.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
            tone='secondary'
            onPress={() => void toggleFreeze()}
          />
        ) : null}
        {card.status !== 'cancelled' ? (
          <ActionButton
            label='Cancel card'
            tone='danger'
            onPress={cancelCard}
          />
        ) : null}
      </View>

      <CardTopUpSheet
        card={card}
        visible={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        onConfirm={(choice) => {
          pendingTopUpRef.current = choice;
          setTopUpOpen(false);
        }}
        onDismissed={() => {
          const choice = pendingTopUpRef.current;
          pendingTopUpRef.current = null;
          if (choice) void runTopUp(choice);
        }}
      />

      {modal}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className='flex-1 gap-1'>
      <Text className='font-sans text-xs text-muted-foreground'>{label}</Text>
      <Text className='font-sans-semibold text-[15px] text-foreground'>{value}</Text>
    </View>
  );
}

function SecretRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onCopy}
      className='flex-row items-center justify-between'
    >
      <View>
        <Text className='font-sans text-xs text-muted-foreground'>{label}</Text>
        <Text className='mt-0.5 font-sans-medium text-base text-foreground'>{value}</Text>
      </View>
      <Icon
        name='copy'
        size={16}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  tone = 'primary',
  flex,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  flex?: boolean;
}) {
  const { colors } = useTheme();
  const fg =
    tone === 'primary'
      ? colors.primaryForeground
      : tone === 'danger'
        ? colors.destructive
        : colors.foreground;

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className={cx(
        'items-center rounded-full py-3 active:opacity-75',
        flex && 'flex-1',
        tone === 'primary'
          ? 'bg-primary'
          : tone === 'danger'
            ? 'border border-destructive bg-destructive-surface'
            : 'border border-border bg-muted',
      )}
    >
      <Text
        className='font-sans-semibold text-[15px]'
        style={{ color: fg }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
