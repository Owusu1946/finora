import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { IconName } from '@/components/ui/icon-mappings';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

/** Shared scroll chrome for settings hub + detail screens. */
export function SettingsScreen({
  children,
  loading,
  contentStyle,
}: {
  children: ReactNode;
  loading?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View
        style={[styles.screenRoot, styles.screenCenter, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <View style={[styles.screenRoot, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.screenContent, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function SettingsSection({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      ) : null}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.composer, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
      {footer ? (
        <Text style={[styles.sectionFooter, { color: colors.mutedForeground }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

type RowProps = {
  label: string;
  detail?: string;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  showChevron?: boolean;
  right?: ReactNode;
  isLast?: boolean;
};

export function SettingsRow({
  label,
  detail,
  icon,
  onPress,
  disabled,
  destructive,
  showChevron,
  right,
  isLast,
}: RowProps) {
  const { colors } = useTheme();
  const labelColor = destructive ? colors.destructive : colors.foreground;
  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Icon
            name={icon}
            size={16}
            color={destructive ? colors.destructive : colors.foreground}
          />
        </View>
      ) : null}
      <View style={styles.rowMeta}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {detail ? (
          <Text
            style={[styles.rowDetail, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {right}
      {showChevron ? (
        <Icon
          name='chevron-right'
          size={18}
          color={colors.mutedForeground}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        disabled={disabled}
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        style={({ pressed }) => [
          styles.row,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          },
          (pressed || disabled) && { opacity: disabled ? 0.45 : 0.7 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        disabled && { opacity: 0.45 },
      ]}
    >
      {content}
    </View>
  );
}

export function SettingsSwitchRow({
  label,
  detail,
  icon,
  value,
  onValueChange,
  disabled,
  isLast,
}: {
  label: string;
  detail?: string;
  icon?: IconName;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <SettingsRow
      label={label}
      detail={detail}
      icon={icon}
      disabled={disabled}
      isLast={isLast}
      right={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            haptics.selection();
            onValueChange(next);
          }}
          trackColor={{ false: colors.muted, true: colors.foreground }}
          thumbColor={colors.background}
          ios_backgroundColor={colors.muted}
        />
      }
    />
  );
}

export function SettingsSegmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.muted }]}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              haptics.selection();
              onChange(opt.id);
            }}
            style={[styles.segmentItem, active && { backgroundColor: colors.background }]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  screenCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 22,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionFooter: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
    marginHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowDetail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  segmentLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
