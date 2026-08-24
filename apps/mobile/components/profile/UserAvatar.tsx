import { Navii } from '@usenavii/react-native';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { AccountType } from '@/lib/account';

import { AppText as Text } from '@/components/ui/text';

type UserAvatarProps = {
  accountType: AccountType;
  backgroundColor: string;
  displayName: string;
  foregroundColor: string;
  imageUrl?: string | null;
  seed: string;
  size: number;
};

export function UserAvatar({
  accountType,
  backgroundColor,
  displayName,
  foregroundColor,
  imageUrl,
  seed,
  size,
}: UserAvatarProps) {
  const frameStyle = {
    backgroundColor,
    borderRadius: size / 2,
    height: size,
    width: size,
  };

  if (accountType === 'personal') {
    return (
      <View style={[styles.frame, frameStyle]}>
        <Navii
          seed={seed}
          size={size}
          title={`${displayName} avatar`}
        />
      </View>
    );
  }

  return (
    <View style={[styles.frame, styles.fallback, frameStyle]}>
      {imageUrl ? (
        <Image
          source={imageUrl}
          style={StyleSheet.absoluteFill}
          contentFit='cover'
          transition={150}
        />
      ) : (
        <Text style={[styles.letter, { color: foregroundColor, fontSize: size * 0.44 }]}>
          {displayName.trim().charAt(0).toUpperCase() || 'F'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: 'DMSans_400Regular',
    fontWeight: '600',
  },
});
