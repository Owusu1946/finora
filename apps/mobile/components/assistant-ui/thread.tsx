import { ThreadPrimitive } from "@assistant-ui/react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { haptics } from "@/lib/haptics";

import { Composer } from "./composer";
import { MessageBubble } from "./message";
import { ScrollToBottomButton, useScrollToBottom } from "./scroll-to-bottom";

const suggestions = ["Check my balance", "Send money", "Receive money", "Create recurring payment"];

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
  return (
    <View style={styles.empty}>
      <Text style={[styles.brand, { color: colors.mutedForeground }]}>Finora</Text>
      <Text style={[styles.welcome, { color: colors.foreground }]}>How can I help you today?</Text>
      <View style={styles.chips}>
        {suggestions.map((prompt) => (
          <SuggestionChip key={prompt} prompt={prompt} />
        ))}
      </View>
    </View>
  );
}

function ChatMessages() {
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
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {() => <MessageBubble />}
          </ThreadPrimitive.MessagesFlatList>

          <ScrollToBottomButton visible={!isAtBottom} onPress={scrollToBottom} />
        </View>
      </ThreadPrimitive.If>
    </>
  );
}

export function Thread() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { colors } = useTheme();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={styles.flex}>
          <ChatMessages />
        </View>
        <View
          style={{
            paddingBottom: keyboardVisible ? 8 : insets.bottom + 8,
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
    width: "100%",
    maxWidth: Spacing.threadMaxWidth,
    marginHorizontal: "auto",
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 18,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  brand: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  welcome: {
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 24,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
