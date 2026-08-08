import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { PASSCODE_LENGTH } from '@/lib/passcode-storage';

export type PasscodeMode = 'setup' | 'confirm-setup' | 'unlock';

type PasscodeModalProps = {
  visible: boolean;
  mode: PasscodeMode;
  title?: string;
  subtitle?: string;
  error?: string | null;
  onClose: () => void;
  /** Called when the user finishes entering PASSCODE_LENGTH digits. */
  onComplete: (passcode: string) => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'back'] as const;

export function PasscodeModal({
  visible,
  mode,
  title,
  subtitle,
  error,
  onClose,
  onComplete,
}: PasscodeModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue('');
  }, [visible, mode]);

  useEffect(() => {
    if (value.length !== PASSCODE_LENGTH) return;
    const code = value;
    const id = setTimeout(() => onComplete(code), 80);
    return () => clearTimeout(id);
  }, [onComplete, value]);

  const copy = useMemo(() => {
    if (title && subtitle) return { title, subtitle };
    if (mode === 'setup') {
      return {
        title: 'Create passcode',
        subtitle: 'You’ll use this to approve money moves in Finora.',
      };
    }
    if (mode === 'confirm-setup') {
      return {
        title: 'Confirm passcode',
        subtitle: 'Enter the same passcode once more.',
      };
    }
    return {
      title: 'Enter passcode',
      subtitle: 'Confirm this transaction with your Finora passcode.',
    };
  }, [mode, subtitle, title]);

  const pushDigit = (digit: string) => {
    if (value.length >= PASSCODE_LENGTH) return;
    haptics.selection();
    setValue((v) => v + digit);
  };

  const backspace = () => {
    if (!value) return;
    haptics.selection();
    setValue((v) => v.slice(0, -1));
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel='Close'
            hitSlop={12}
            onPress={() => {
              haptics.selection();
              onClose();
            }}
          >
            <Icon
              name='remove'
              size={22}
              color={colors.foreground}
            />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={[styles.shield, { backgroundColor: colors.muted }]}>
            <Icon
              name='shield'
              size={22}
              color={colors.foreground}
            />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{copy.subtitle}</Text>
        </View>

        <View style={styles.dots}>
          {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => {
            const filled = i < value.length;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    borderColor: error ? colors.destructive : colors.border,
                    backgroundColor: filled
                      ? error
                        ? colors.destructive
                        : colors.foreground
                      : 'transparent',
                  },
                ]}
              />
            );
          })}
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : (
          <View style={styles.errorSpacer} />
        )}

        <View style={styles.pad}>
          {KEYS.map((key) => {
            if (key === 'bio') {
              // Placeholder only — Face ID / Touch ID not wired yet.
              if (mode !== 'unlock') {
                return (
                  <View
                    key='bio'
                    style={styles.key}
                  />
                );
              }
              return (
                <Pressable
                  key='bio'
                  accessibilityLabel='Biometric unlock (coming soon)'
                  accessibilityHint='Biometric authentication is not available yet. Enter your passcode.'
                  onPress={() => {
                    haptics.selection();
                  }}
                  style={({ pressed }) => [styles.key, pressed && { opacity: 0.55 }]}
                >
                  <Icon
                    name='biometric'
                    size={28}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              );
            }
            if (key === 'back') {
              return (
                <Pressable
                  key='back'
                  accessibilityLabel='Delete'
                  onPress={backspace}
                  style={({ pressed }) => [styles.key, pressed && { opacity: 0.55 }]}
                >
                  <Icon
                    name='chevron-left'
                    size={26}
                    color={colors.foreground}
                  />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={key}
                accessibilityLabel={`Digit ${key}`}
                onPress={() => pushDigit(key)}
                style={({ pressed }) => [
                  styles.key,
                  styles.keyDigit,
                  {
                    backgroundColor: pressed ? colors.muted : colors.composer,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.keyLabel, { color: colors.foreground }]}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 28,
  },
  shield: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    minHeight: 20,
    marginBottom: 18,
  },
  errorSpacer: {
    height: 20,
    marginBottom: 18,
  },
  pad: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  key: {
    width: '31%',
    aspectRatio: 1.55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.composer,
  },
  keyDigit: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
});
