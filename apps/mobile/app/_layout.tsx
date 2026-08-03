import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Redirect, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { setAccountType } from '@/lib/account';
import { AuthGateProvider, useAuthGate } from '@/lib/auth-gate';
import { getAuthSession } from '@/lib/auth-storage';
import { finoraChatAdapter } from '@/lib/chat-adapter';
import { OnboardingGateProvider, useOnboardingGate } from '@/lib/onboarding-gate';
import { getOnboardingState } from '@/lib/onboarding-storage';

export const unstable_settings = {
  anchor: '(app)',
};

const feedbackAdapter = {
  submit: async ({ type }: { type: 'positive' | 'negative' }) => {
    console.log(`[Finora Feedback]: ${type}`);
  },
};

function RootNavigator() {
  const { authenticated } = useAuthGate();
  const { completed: onboardingCompleted } = useOnboardingGate();
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
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name='onboarding' />
        <Stack.Screen name='auth' />
        <Stack.Screen name='(app)' />
      </Stack>
      {!onboardingCompleted ? <Redirect href={'/onboarding' as Href} /> : null}
      {onboardingCompleted && !authenticated ? (
        <Redirect href={'/auth' as Href} />
      ) : null}
      <StatusBar style='auto' />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(Platform.OS === 'ios' ? {} : MaterialIcons.font);
  const [boot, setBoot] = useState<{
    authenticated: boolean;
    onboardingCompleted: boolean;
  } | null>(null);
  const runtime = useLocalRuntime(finoraChatAdapter, {
    adapters: {
      feedback: feedbackAdapter,
    },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [session, onboarding] = await Promise.all([
        getAuthSession(),
        getOnboardingState(),
      ]);
      if (cancelled) return;
      if (onboarding.accountType) setAccountType(onboarding.accountType);
      setBoot({
        authenticated: session,
        onboardingCompleted: onboarding.completed,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fontsLoaded || boot === null) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthGateProvider authenticated={boot.authenticated}>
        <OnboardingGateProvider completed={boot.onboardingCompleted}>
          <AssistantRuntimeProvider runtime={runtime}>
            <RootNavigator />
          </AssistantRuntimeProvider>
        </OnboardingGateProvider>
      </AuthGateProvider>
    </GestureHandlerRootView>
  );
}
