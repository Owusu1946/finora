import type { ReactNode } from 'react';

import { useRouter, type Href } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { cx } from '@/lib/cx';
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
    <View className='flex-1 bg-background'>
      <AuthCanvas colors={colors} />
      <KeyboardAvoidingView
        className='flex-1'
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerClassName='grow px-6'
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          <View className='h-7 justify-center'>
            {showBack ? (
              <Pressable
                accessibilityLabel='Go back'
                hitSlop={12}
                onPress={() => {
                  haptics.selection();
                  if (router.canGoBack()) router.back();
                  else router.replace('/auth' as Href);
                }}
                className='active:opacity-50'
              >
                <Icon
                  name='chevron-left'
                  size={24}
                  color={colors.foreground}
                />
              </Pressable>
            ) : (
              <View className='h-6' />
            )}
          </View>

          <View className='grow justify-center gap-[22px] py-3'>{children}</View>
          {footer ? <View className='w-full gap-3 pt-4'>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
