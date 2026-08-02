import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useTheme } from "@/hooks/use-theme";
import { finoraChatAdapter } from "@/lib/chat-adapter";

export const unstable_settings = {
  anchor: "(app)",
};

const feedbackAdapter = {
  submit: async ({ type }: { type: "positive" | "negative" }) => {
    console.log(`[Finora Feedback]: ${type}`);
  },
};

function RootNavigator() {
  const { isDark, colors } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      text: colors.foreground,
      border: colors.border,
      primary: colors.foreground,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(Platform.OS === "ios" ? {} : MaterialIcons.font);
  const runtime = useLocalRuntime(finoraChatAdapter, {
    adapters: {
      feedback: feedbackAdapter,
    },
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AssistantRuntimeProvider runtime={runtime}>
        <RootNavigator />
      </AssistantRuntimeProvider>
    </GestureHandlerRootView>
  );
}
