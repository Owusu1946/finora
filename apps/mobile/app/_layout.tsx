import {
  AssistantRuntimeProvider,
  useLocalRuntime,
} from '@assistant-ui/react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Redirect, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../global.css';

import { useTheme } from '@/hooks/use-theme';
import { setAccountType } from '@/lib/account';
import { AuthGateProvider, useAuthGate } from '@/lib/auth-gate';
import { getAuthSession } from '@/lib/auth-storage';
import { finoraChatAdapter } from '@/lib/chat-adapter';
import { OnboardingGateProvider, useOnboardingGate } from '@/lib/onboarding-gate';
import { getOnboardingState } from '@/lib/onboarding-storage';
import { FundAccountToolUI } from '@/components/chat/FundAccountToolUI';
import { PreparePaymentToolUI } from '@/components/chat/PreparePaymentToolUI';
import { ListReceiveMethodsToolUI } from '@/components/chat/ListReceiveMethodsToolUI';
import {
  CreatePaymentRequestToolUI,
  GeneratePaymentLinkToolUI,
} from '@/components/chat/CreatePaymentRequestToolUI';
import { GetBalancesToolUI } from '@/components/chat/GetBalancesToolUI';
import { PrepareConversionToolUI } from '@/components/chat/PrepareConversionToolUI';
import { ListInvoicesToolUI } from '@/components/chat/ListInvoicesToolUI';
import { PrepareRecurringToolUI } from '@/components/chat/PrepareRecurringToolUI';
import { SchedulePaymentWizardToolUI } from '@/components/chat/SchedulePaymentWizardToolUI';
import { ResolveSendToolUI } from '@/components/chat/ResolveSendToolUI';
import { CreateFinancialPlanToolUI } from '@/components/chat/CreateFinancialPlanToolUI';
import { SettingsProvider } from '@/lib/settings-context';
import { useDrainPendingPaymentLink } from '@/lib/use-drain-pending-payment-link';

export const unstable_settings = {
  anchor: '(app)',
};

function RootNavigator() {
  const { authenticated } = useAuthGate();
  const { completed: onboardingCompleted } = useOnboardingGate();
  const { isDark, colors } = useTheme();
  useDrainPendingPaymentLink();
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
        <Stack.Screen name='pay/r/[id]' />
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
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    ...(Platform.OS === 'ios' ? {} : MaterialIcons.font),
  });
  const [boot, setBoot] = useState<{
    authenticated: boolean;
    onboardingCompleted: boolean;
  } | null>(null);
  const runtime = useLocalRuntime(finoraChatAdapter as never);

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
      <SettingsProvider>
        <AuthGateProvider authenticated={boot.authenticated}>
          <OnboardingGateProvider completed={boot.onboardingCompleted}>
            <AssistantRuntimeProvider runtime={runtime}>
              <PreparePaymentToolUI />
              <FundAccountToolUI />
              <ListReceiveMethodsToolUI />
              <CreatePaymentRequestToolUI />
              <GeneratePaymentLinkToolUI />
              <GetBalancesToolUI />
              <PrepareConversionToolUI />
              <ListInvoicesToolUI />
              <PrepareRecurringToolUI />
              <SchedulePaymentWizardToolUI />
              <ResolveSendToolUI />
              <CreateFinancialPlanToolUI />
              <RootNavigator />
            </AssistantRuntimeProvider>
          </OnboardingGateProvider>
        </AuthGateProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
