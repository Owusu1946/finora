import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
import { haptics } from '@/lib/haptics';

import { AVATAR_COLORS, type Contact } from './types';

interface ContactListItemProps {
  contact: Contact;
  index: number;
  isLast: boolean;
  onPress?: (contact: Contact) => void;
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const ContactListItem = memo(function ContactListItem({
  contact,
  index,
  isLast,
  onPress,
}: ContactListItemProps) {
  const { colors } = useTheme();
  const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.(contact);
      }}
      className={cx(
        'flex-row items-center gap-3 py-3.5 active:opacity-70',
        !isLast && 'border-b border-border',
      )}
    >
      {/* Avatar */}
      <View
        className='h-[38px] w-[38px] items-center justify-center rounded-full'
        style={{ backgroundColor: avatarBg }}
      >
        <Text className='font-sans-semibold text-[15px] text-white'>{contact.initials}</Text>
      </View>

      {/* Name + method */}
      <View className='flex-1 gap-0.5'>
        <View className='flex-row items-center gap-[5px]'>
          <Text
            className='font-sans-semibold text-base text-foreground'
            numberOfLines={1}
          >
            {contact.name}
          </Text>
          {contact.favourite && (
            <Icon
              name='check'
              size={12}
              color={colors.primary}
            />
          )}
        </View>
        <Text className='font-sans text-[13px] text-muted-foreground'>
          {contact.method} • {contact.identifier}
        </Text>
      </View>

      {/* Last tx date */}
      <View className='flex-row items-center gap-1.5'>
        {contact.lastTxDate ? (
          <Text className='font-sans text-[13px] text-muted-foreground'>
            {relativeDate(contact.lastTxDate)}
          </Text>
        ) : (
          <Text className='font-sans text-[13px] text-muted-foreground'>Never</Text>
        )}
        <Icon
          name='chevron-right'
          size={14}
          color={colors.border}
        />
      </View>
    </Pressable>
  );
});
