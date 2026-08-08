import { StyleSheet, Text, View, Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
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

export function ContactListItem({ contact, index, isLast, onPress }: ContactListItemProps) {
  const { colors } = useTheme();
  const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.(contact);
      }}
      style={({ pressed }) => [
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={styles.initials}>{contact.initials}</Text>
      </View>

      {/* Name + method */}
      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: colors.foreground }]}
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
        <Text style={[styles.detail, { color: colors.mutedForeground }]}>
          {contact.method} • {contact.identifier}
        </Text>
      </View>

      {/* Last tx date */}
      <View style={styles.right}>
        {contact.lastTxDate ? (
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
            {relativeDate(contact.lastTxDate)}
          </Text>
        ) : (
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>Never</Text>
        )}
        <Icon
          name='chevron-right'
          size={14}
          color={colors.border}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '400',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    fontWeight: '400',
  },
});
