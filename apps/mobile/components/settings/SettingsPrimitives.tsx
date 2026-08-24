import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from '@/components/ui/icon-mappings';

import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';
import { usePressGuard } from '@/lib/use-press-guard';

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
      <View className='flex-1 items-center justify-center bg-background'>
        <LoadingIcon color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <View className='flex-1 bg-background'>
      <ScrollView
        contentContainerClassName='grow pb-12'
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        <View
          className='gap-[22px] px-5 pb-12 pt-3'
          style={contentStyle}
        >
          {children}
        </View>
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
  return (
    <View className='gap-2'>
      {title ? (
        <Text className='ml-1 font-sans-semibold text-sm uppercase tracking-[0.2px] text-muted-foreground'>
          {title}
        </Text>
      ) : null}
      <View
        className='overflow-hidden rounded-2xl border border-border bg-composer'
        style={{ borderCurve: 'continuous' }}
      >
        {children}
      </View>
      {footer ? (
        <Text className='mx-1 font-sans-medium text-[13px] leading-[17px] text-muted-foreground'>
          {footer}
        </Text>
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
  const guard = usePressGuard();
  const labelColor = destructive ? colors.destructive : colors.foreground;
  const content = (
    <>
      {icon ? (
        <View className='h-8 w-8 items-center justify-center rounded-full bg-muted'>
          <Icon
            name={icon}
            size={16}
            color={destructive ? colors.destructive : colors.foreground}
          />
        </View>
      ) : null}
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          className='font-sans-medium text-[17px] tracking-[-0.2px]'
          style={{ color: labelColor }}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            className='font-sans-medium text-sm tracking-[-0.1px] text-muted-foreground'
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
        onPress={() =>
          guard(() => {
            haptics.selection();
            onPress();
          })
        }
        className={cx(
          'min-h-[52px] flex-row items-center gap-3 px-3.5 py-3.5 active:opacity-70 disabled:opacity-45',
          !isLast && 'border-b border-border',
        )}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      className={cx(
        'min-h-[52px] flex-row items-center gap-3 px-3.5 py-3.5',
        !isLast && 'border-b border-border',
        disabled && 'opacity-45',
      )}
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
  onValueChange: (next: boolean) => void | boolean | Promise<void | boolean>;
  disabled?: boolean;
  isLast?: boolean;
}) {
  const { colors } = useTheme();
  const [optimisticValue, setOptimisticValue] = useState(value);
  const controlledValueRef = useRef(value);
  const requestRef = useRef(0);

  useEffect(() => {
    controlledValueRef.current = value;
    setOptimisticValue(value);
  }, [value]);

  return (
    <SettingsRow
      label={label}
      detail={detail}
      icon={icon}
      disabled={disabled}
      isLast={isLast}
      right={
        <Switch
          value={optimisticValue}
          disabled={disabled}
          onValueChange={async (next) => {
            const request = ++requestRef.current;
            setOptimisticValue(next);
            haptics.selection();
            try {
              const accepted = await onValueChange(next);
              if (request !== requestRef.current) return;
              if (accepted === false) {
                setOptimisticValue(controlledValueRef.current);
              }
            } catch {
              if (request !== requestRef.current) return;
              setOptimisticValue(controlledValueRef.current);
            }
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
    <View className='flex-row gap-0.5 rounded-full bg-muted p-[3px]'>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              haptics.selection();
              onChange(opt.id);
            }}
            className={cx(
              'flex-1 items-center justify-center rounded-full py-2 active:opacity-75',
              active && 'border border-border bg-background',
            )}
          >
            <Text
              className='font-sans-semibold text-sm tracking-[-0.1px]'
              style={{ color: active ? colors.foreground : colors.mutedForeground }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
