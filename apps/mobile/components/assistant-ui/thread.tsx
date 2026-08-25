import { ThreadPrimitive } from '@assistant-ui/react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinoraLogo } from '@/components/ui/finora-mark';
import { AppText as Text } from '@/components/ui/text';
import { Radius, Rounded, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isBusinessAccount } from '@/lib/account';
import { haptics } from '@/lib/haptics';

import { Composer } from './composer';
import { MessageBubble } from './message';
import { ScrollToBottomButton, useScrollToBottom } from './scroll-to-bottom';

const renderMessage = () => <MessageBubble />;

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

const PERSONAL_SUGGESTIONS = [
  'Check my balance',
  'Send 50 GHS to 0559182794',
  'Receive money',
  'Convert 100 USD to GHS',
];

const BUSINESS_SUGGESTIONS = [
  'Show treasury overview',
  'Run payroll',
  'Pay TechFlow 780 GBP',
  'Show business expenses this month',
  'Pay everything due today',
];

function SuggestionChip({ prompt }: { prompt: string }) {
  const { colors } = useTheme();
  return (
    <ThreadPrimitive.Suggestion
      prompt={prompt}
      send
      onPressIn={haptics.selection}
      style={({ pressed }: { pressed: boolean }) => [
        styles.chip,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.muted : colors.background,
        },
      ]}
    >
      <Text className='font-sans text-[15px] tracking-[-0.2px] text-foreground'>{prompt}</Text>
    </ThreadPrimitive.Suggestion>
  );
}

function EmptyState() {
  const suggestions = isBusinessAccount() ? BUSINESS_SUGGESTIONS : PERSONAL_SUGGESTIONS;
  return (
    <Pressable
      accessible={false}
      onPress={Keyboard.dismiss}
      className='flex-1 justify-center items-center px-6 gap-2.5'
    >
      <FinoraLogo size={48} />
      <Text className='font-sans-semibold text-[25px] tracking-[-0.4px] text-center mb-6 text-foreground'>
        How can I help you today?
      </Text>
      <View className='flex-row flex-wrap justify-center gap-2'>
        {suggestions.map((prompt) => (
          <SuggestionChip
            key={prompt}
            prompt={prompt}
          />
        ))}
      </View>
    </Pressable>
  );
}

function ChatMessages({ headerHeight }: { headerHeight: number }) {
  const { flatListRef, isAtBottom, scrollToBottom, onScroll } = useScrollToBottom();
  const { colors } = useTheme();

  return (
    <>
      <ThreadPrimitive.Empty>
        <EmptyState />
      </ThreadPrimitive.Empty>
      <ThreadPrimitive.If empty={false}>
        <View className='flex-1'>
          <ThreadPrimitive.MessagesFlatList
            ref={flatListRef}
            className='flex-1'
            contentContainerStyle={[
              styles.messageList,
              { paddingTop: headerHeight + 20, backgroundColor: colors.background },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode='interactive'
            onScroll={onScroll}
            scrollEventThrottle={16}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            updateCellsBatchingPeriod={50}
            windowSize={7}
          >
            {renderMessage}
          </ThreadPrimitive.MessagesFlatList>

          <ScrollToBottomButton
            visible={!isAtBottom}
            onPress={scrollToBottom}
          />
        </View>
      </ThreadPrimitive.If>
    </>
  );
}

export function Thread() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    if (!isFocused) {
      setKeyboardVisible(false);
      Keyboard.dismiss();
      return;
    }

    setKeyboardVisible(Keyboard.isVisible());
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isFocused]);

  return (
    <View className='flex-1 bg-transparent'>
      <KeyboardAvoidingView
        className='flex-1'
        // Android `height` resizes the whole tree when the picker/keyboard
        // dismisses and feels like a full reload — leave avoidance to insets.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // This route uses a transparent overlay header, so the scene occupies
        // the full window and must avoid the full keyboard height.
        keyboardVerticalOffset={0}
        enabled={isFocused && Platform.OS === 'ios'}
      >
        <View className='flex-1'>
          <ChatMessages headerHeight={headerHeight} />
          {/* Top subtle gradient mask for status bar & header scroll-through */}
          <LinearGradient
            pointerEvents='none'
            colors={[
              hexToRgba(colors.background, 1),
              hexToRgba(colors.background, 0.96),
              hexToRgba(colors.background, 0.72),
              hexToRgba(colors.background, 0.25),
              hexToRgba(colors.background, 0),
            ]}
            locations={[0, 0.42, 0.68, 0.88, 1]}
            style={[styles.topGradient, { height: headerHeight + 36 }]}
          />
        </View>
        <View
          style={{
            paddingBottom: keyboardVisible ? 8 : insets.bottom + 6,
          }}
        >
          <Composer />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = {
  messageList: {
    width: '100%',
    maxWidth: Spacing.threadMaxWidth,
    marginHorizontal: 'auto',
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 18,
  },
  chip: {
    ...Rounded,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topGradient: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
} as const;
