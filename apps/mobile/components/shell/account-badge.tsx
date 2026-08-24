import { View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { getAccountFullLabel, getAccountLabel, getAccountType } from '@/lib/account';
import { cx } from '@/lib/cx';

type AccountBadgeProps = {
  /** Compact pill for headers; full label for drawer. */
  variant?: 'pill' | 'text';
};

export function AccountBadge({ variant = 'pill' }: AccountBadgeProps) {
  const type = getAccountType();
  const label = getAccountLabel(type);

  if (variant === 'text') {
    return (
      <Text className='mt-0.5 font-sans-medium text-[13px] text-muted-foreground'>
        {getAccountFullLabel(type)}
      </Text>
    );
  }

  return (
    <View
      className='flex-row items-center gap-[5px] rounded-full border border-border bg-muted px-2 py-0.5'
      accessibilityLabel={`${label} account`}
    >
      <View
        className={cx(
          'h-[5px] w-[5px] rounded-full',
          type === 'business' ? 'bg-foreground' : 'bg-muted-foreground',
        )}
      />
      <Text className='font-sans-semibold text-xs tracking-[0.1px] text-muted-foreground'>
        {label}
      </Text>
    </View>
  );
}

type HeaderTitleProps = {
  title: string;
};

/** Centered header title with account type pill underneath. */
export function HeaderTitleWithAccount({ title }: HeaderTitleProps) {
  return (
    <View className='items-center justify-center gap-[3px]'>
      <Text
        numberOfLines={1}
        className='font-sans-semibold text-lg tracking-[-0.2px] text-foreground'
      >
        {title}
      </Text>
      <AccountBadge />
    </View>
  );
}
