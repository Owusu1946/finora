import { ThreadPrimitive } from '@assistant-ui/react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
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
      <Text style={[styles.chipText, { color: colors.foreground }]}>{prompt}</Text>
    </ThreadPrimitive.Suggestion>
  );
}

function EmptyState() {
  const { colors } = useTheme();
  const suggestions = isBusinessAccount() ? BUSINESS_SUGGESTIONS : PERSONAL_SUGGESTIONS;
  return (
    <Pressable
      accessible={false}
      onPress={Keyboard.dismiss}
      style={styles.empty}
    >
      <FinoraLogo size={48} />
      <Text style={[styles.welcome, { color: colors.foreground }]}>How can I help you today?</Text>
      <View style={styles.chips}>
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

  return (
    <>
      <ThreadPrimitive.Empty>
        <EmptyState />
      </ThreadPrimitive.Empty>
      <ThreadPrimitive.If empty={false}>
        <View style={styles.flex}>
          <ThreadPrimitive.MessagesFlatList
            ref={flatListRef}
            style={styles.flex}
            contentContainerStyle={[styles.messageList, { paddingTop: headerHeight + 20 }]}
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        // Android `height` resizes the whole tree when the picker/keyboard
        // dismisses and feels like a full reload — leave avoidance to insets.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // This route uses a transparent overlay header, so the scene occupies
        // the full window and must avoid the full keyboard height.
        keyboardVerticalOffset={0}
        enabled={isFocused && Platform.OS === 'ios'}
      >
        <View style={styles.flex}>
          <ChatMessages headerHeight={headerHeight} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  messageList: {
    width: '100%',
    maxWidth: Spacing.threadMaxWidth,
    marginHorizontal: 'auto',
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 18,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  welcome: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 24,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    ...Rounded,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
