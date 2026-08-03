import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import { AuthCanvas } from './AuthCanvas';

type AuthShellProps = {
  children: ReactNode;
  showBack?: boolean;
  footer?: ReactNode;
};

export function AuthShell({ children, showBack = false, footer }: AuthShellProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuthCanvas colors={colors} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
            },
          ]}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            {showBack ? (
              <Pressable
                accessibilityLabel='Go back'
                hitSlop={12}
                onPress={() => {
                  haptics.selection();
                  if (router.canGoBack()) router.back();
                  else router.replace('/auth' as Href);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
              >
                <Icon
                  name='chevron-left'
                  size={24}
                  color={colors.foreground}
                />
              </Pressable>
            ) : (
              <View style={styles.topSpacer} />
            )}
          </View>

          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    height: 28,
    justifyContent: 'center',
  },
  topSpacer: {
    height: 24,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 12,
  },
  footer: {
    gap: 12,
    paddingTop: 16,
    width: '100%',
  },
});
