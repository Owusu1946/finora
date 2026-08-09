import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { VirtualCardFace } from '@/components/cards/VirtualCardFace';
import {
  formatCardAmount,
  formatPanGrouped,
  remainingLimit,
  type VirtualCard,
} from '@/components/cards/types';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import {
  setVirtualCardStatus,
  updateVirtualCard,
} from '@/lib/virtual-cards-storage';

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
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState(String(initial.spendLimit));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCard(initial);
    setLimitDraft(String(initial.spendLimit));
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

  const saveLimit = async () => {
    const n = Number(limitDraft.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    const next = await updateVirtualCard(card.id, { spendLimit: n });
    setBusy(false);
    if (!next) return;
    haptics.success();
    setEditingLimit(false);
    apply(next);
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
    <View style={styles.root}>
      <VirtualCardFace
        card={card}
        compact={compactFace}
        tilt
        revealed={revealed}
        side={cardSide}
        onFlipGesture={() => void flipCard()}
      />

      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>Spending</Text>
      <View
        style={[
          styles.panel,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: '#000',
          },
        ]}
      >
        <Stat
          label='Spent'
          value={formatCardAmount(card.spent, card.currency)}
        />
        <Stat
          label='Remaining'
          value={formatCardAmount(remainingLimit(card), card.currency)}
        />
        <Stat
          label='Limit'
          value={formatCardAmount(card.spendLimit, card.currency)}
        />
      </View>

      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>Card details</Text>
      <View
        style={[
          styles.panel,
          styles.secrets,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: '#000',
          },
        ]}
      >
        <View style={styles.secretsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            Number · expiry · CVV
          </Text>
          <View style={styles.secretActions}>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={cardSide === 'back' ? 'Show front of card' : 'Show back of card'}
              onPress={() => void flipCard()}
              disabled={busy || card.status === 'cancelled'}
              style={({ pressed }) => [
                styles.revealBtn,
                {
                  backgroundColor: colors.muted,
                  opacity: pressed || card.status === 'cancelled' ? 0.6 : 1,
                },
              ]}
            >
              <Icon
                name='card'
                size={14}
                color={colors.foreground}
              />
              <Text style={[styles.revealText, { color: colors.foreground }]}>
                {cardSide === 'back' ? 'Show front' : 'Show back'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={revealed ? 'Card details visible' : 'Reveal card details'}
              onPress={() => void reveal()}
              disabled={busy || card.status === 'cancelled' || revealed}
              style={({ pressed }) => [
                styles.revealBtn,
                {
                  backgroundColor: colors.muted,
                  opacity: pressed || card.status === 'cancelled' ? 0.6 : 1,
                },
              ]}
            >
              <Icon
                name={revealed ? 'eye' : 'eye-off'}
                size={14}
                color={colors.foreground}
              />
              <Text style={[styles.revealText, { color: colors.foreground }]}>
                {revealed ? 'Visible' : 'Reveal'}
              </Text>
            </Pressable>
          </View>
        </View>

        {revealed ? (
          <View style={styles.secretRows}>
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
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Details hide automatically after 30 seconds.
            </Text>
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Turn your wrist or use Show back. Passcode required before details appear.
          </Text>
        )}
      </View>

      {editingLimit ? (
        <View style={[styles.editBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Edit limit</Text>
          <TextInput
            value={limitDraft}
            onChangeText={(t) => setLimitDraft(t.replace(/[^0-9.]/g, ''))}
            keyboardType='decimal-pad'
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
          <View style={styles.row}>
            <ActionButton
              label='Cancel'
              tone='secondary'
              flex
              onPress={() => setEditingLimit(false)}
            />
            <ActionButton
              label='Save'
              flex
              onPress={() => void saveLimit()}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {card.status !== 'cancelled' ? (
          <ActionButton
            label={card.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
            onPress={() => void toggleFreeze()}
          />
        ) : null}
        {card.status !== 'cancelled' ? (
          <ActionButton
            label='Edit limit'
            tone='secondary'
            onPress={() => setEditingLimit(true)}
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

      {modal}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function SecretRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onCopy}
      style={styles.secretRow}
    >
      <View>
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.secretValue, { color: colors.foreground }]}>{value}</Text>
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
  const bg =
    tone === 'primary' ? colors.primary : tone === 'danger' ? colors.destructiveSurface : colors.muted;
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
      style={({ pressed }) => [
        styles.actionBtn,
        flex ? styles.actionBtnFlex : null,
        {
          backgroundColor: bg,
          borderColor: tone === 'danger' ? colors.destructive : colors.border,
          borderWidth: tone === 'secondary' || tone === 'danger' ? StyleSheet.hairlineWidth : 0,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  sectionHeading: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 20,
    letterSpacing: -0.4,
    marginTop: 12,
    marginBottom: 2,
  },
  panel: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
  },
  statValue: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
  },
  secrets: {
    flexDirection: 'column',
    gap: 10,
  },
  secretsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  secretActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  revealText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  secretRows: {
    gap: 10,
  },
  secretRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secretValue: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: 8,
  },
  actionBtn: {
    borderRadius: Radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnFlex: {
    flex: 1,
  },
  actionText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
  },
  editBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 14,
    gap: 10,
  },
  input: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
