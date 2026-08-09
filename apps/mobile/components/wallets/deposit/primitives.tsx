import { AppText as Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

import { depositStyles as styles } from './styles';
import type { DepositPalette } from './types';

export function IconStack({ children }: { children: ReactNode[] }) {
  return (
    <View style={styles.iconStack}>
      {children.map((child, i) => (
        <View
          key={i}
          style={[styles.iconStackItem, { marginLeft: i === 0 ? 0 : -10, zIndex: children.length - i }]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

export function MetaRow({
  eta,
  fee,
  muted,
}: {
  eta: string;
  fee?: string;
  muted: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Icon
        name='clock'
        size={13}
        color={muted}
      />
      <Text style={[styles.metaText, { color: muted }]}>{eta}</Text>
      {fee ? (
        <>
          <Text style={[styles.metaDot, { color: muted }]}>·</Text>
          <Icon
            name='dollar'
            size={13}
            color={muted}
          />
          <Text style={[styles.metaText, { color: muted }]}>{fee}</Text>
        </>
      ) : null}
    </View>
  );
}

export function InfoBanner({
  colors,
  title = 'Important',
  body,
  tone = 'neutral',
}: {
  colors: Pick<DepositPalette, 'muted' | 'foreground' | 'mutedForeground'>;
  title?: string;
  body: string;
  tone?: 'neutral' | 'info';
}) {
  const bg = tone === 'info' ? 'rgba(37, 99, 235, 0.08)' : colors.muted;
  const fg = tone === 'info' ? '#1d4ed8' : colors.foreground;
  const muted = tone === 'info' ? '#1e40af' : colors.mutedForeground;
  return (
    <View style={[styles.infoBanner, { backgroundColor: bg }]}>
      <Icon
        name='info'
        size={18}
        color={fg}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.infoTitle, { color: fg }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: muted }]}>{body}</Text>
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  colors,
  onPress,
  disabled,
}: {
  label: string;
  icon?: 'share';
  colors: Pick<DepositPalette, 'foreground' | 'background' | 'muted' | 'mutedForeground'>;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: disabled ? colors.muted : colors.foreground,
          opacity: pressed && !disabled ? 0.88 : 1,
        },
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={16}
          color={disabled ? colors.mutedForeground : colors.background}
        />
      ) : null}
      <Text
        style={[
          styles.primaryBtnText,
          { color: disabled ? colors.mutedForeground : colors.background },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DepositSheetHeader({
  title,
  colors,
  showBack,
  onBack,
  onClose,
}: {
  title: string;
  colors: DepositPalette;
  showBack?: boolean;
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <View style={styles.sheetHeader}>
      {showBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Icon
            name='chevron-left'
            size={22}
            color={colors.foreground}
          />
        </Pressable>
      ) : null}
      <Text
        style={[
          styles.sheetTitle,
          { color: colors.foreground, flex: 1, textAlign: showBack ? 'center' : 'left' },
          showBack && { marginRight: 30 },
        ]}
      >
        {title}
      </Text>
      {!showBack && onClose ? (
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
      ) : null}
    </View>
  );
}

export function CopyAddressRow({
  label,
  value,
  copied,
  colors,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  colors: DepositPalette;
  mono?: boolean;
  onCopy: () => void;
}) {
  return (
    <View style={[styles.addressBox, { backgroundColor: colors.muted }]}>
      <View style={styles.addressHeader}>
        <Text style={[styles.addressLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Pressable
          onPress={onCopy}
          style={styles.copyLink}
        >
          <Text style={[styles.copyLinkText, { color: colors.foreground }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
          <Icon
            name={copied ? 'check' : 'copy'}
            size={14}
            color={colors.foreground}
          />
        </Pressable>
      </View>
      <Text
        selectable={mono}
        style={[
          mono ? styles.addressValueMono : styles.addressValue,
          { color: colors.foreground },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
