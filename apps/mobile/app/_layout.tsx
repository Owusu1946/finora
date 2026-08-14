import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessageLike,
} from '@assistant-ui/react-native';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import '../global.css';

import { VirtualCardIssuedPopup } from '@/components/cards/VirtualCardIssuedPopup';
import { CreateEmployeeToolUI } from '@/components/chat/CreateEmployeeToolUI';
import { CreateFinancialPlanToolUI } from '@/components/chat/CreateFinancialPlanToolUI';
import {
  CreatePaymentRequestToolUI,
  GeneratePaymentLinkToolUI,
} from '@/components/chat/CreatePaymentRequestToolUI';
import { CreateVirtualCardToolUI } from '@/components/chat/CreateVirtualCardToolUI';
import { FinancialReportToolUI } from '@/components/chat/FinancialReportToolUI';
import { FundAccountToolUI } from '@/components/chat/FundAccountToolUI';
import { GetBalancesToolUI } from '@/components/chat/GetBalancesToolUI';
import { GetVirtualCardToolUI } from '@/components/chat/GetVirtualCardToolUI';
import { ListAutomationsToolUI } from '@/components/chat/ListAutomationsToolUI';
import { ListBeneficiariesToolUI } from '@/components/chat/ListBeneficiariesToolUI';
import { ListCalendarDuesToolUI } from '@/components/chat/ListCalendarDuesToolUI';
import { ListEmployeesToolUI } from '@/components/chat/ListEmployeesToolUI';
import { ListExpensesToolUI } from '@/components/chat/ListExpensesToolUI';
import { ListInvoicesToolUI } from '@/components/chat/ListInvoicesToolUI';
import { ListPoliciesToolUI } from '@/components/chat/ListPoliciesToolUI';
import { ListReceiveMethodsToolUI } from '@/components/chat/ListReceiveMethodsToolUI';
import { ListSmsRequestsToolUI } from '@/components/chat/ListSmsRequestsToolUI';
import { ListSuppliersToolUI } from '@/components/chat/ListSuppliersToolUI';
import { ListVirtualAccountsToolUI } from '@/components/chat/ListVirtualAccountsToolUI';
import { ListVirtualCardsToolUI } from '@/components/chat/ListVirtualCardsToolUI';
import { PrepareConversionToolUI } from '@/components/chat/PrepareConversionToolUI';
import { PrepareEmployeePaymentToolUI } from '@/components/chat/PrepareEmployeePaymentToolUI';
import { PrepareInternalTransferToolUI } from '@/components/chat/PrepareInternalTransferToolUI';
import { PreparePaymentToolUI } from '@/components/chat/PreparePaymentToolUI';
import { PreparePayrollToolUI } from '@/components/chat/PreparePayrollToolUI';
import { PrepareRecurringToolUI } from '@/components/chat/PrepareRecurringToolUI';
import { PrepareSupplierPaymentToolUI } from '@/components/chat/PrepareSupplierPaymentToolUI';
import { ResolveSendToolUI } from '@/components/chat/ResolveSendToolUI';
import { SchedulePaymentWizardToolUI } from '@/components/chat/SchedulePaymentWizardToolUI';
import { TreasuryOverviewToolUI } from '@/components/chat/TreasuryOverviewToolUI';
import { AppSwitcherPrivacy } from '@/components/privacy/AppSwitcherPrivacy';
import { SplashOverlay, SplashPlaceholder } from '@/components/splash/SplashOverlay';
import { useSplashGate } from '@/components/splash/useSplashGate';
import { SPLASH_BACKGROUND } from '@/components/ui/finora-mark-paths';
import { useTheme } from '@/hooks/use-theme';
import { setAccountType } from '@/lib/account';
import { getApiUrl } from '@/lib/api-url';
import { AuthGateProvider, useAuthGate } from '@/lib/auth-gate';
import { getTagConfigured } from '@/lib/auth-storage';
import { finoraChatAdapter } from '@/lib/chat-adapter';
import { env } from '@/lib/env';
import { OnboardingGateProvider, useOnboardingGate } from '@/lib/onboarding-gate';
import { getOnboardingState } from '@/lib/onboarding-storage';
import { PhoneGateProvider, usePhoneGate } from '@/lib/phone-gate';
import {
  createRemoteChatAdapter,
  createRemoteChatResumeStream,
  loadRemoteChatBootstrap,
} from '@/lib/remote-chat-adapter';
import { SettingsProvider } from '@/lib/settings-context';
import { useDrainPendingPaymentLink } from '@/lib/use-drain-pending-payment-link';
import { useProfileSync } from '@/lib/use-profile-sync';

const publishableKey = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

type RemoteChatRuntime = {
  adapter: ChatModelAdapter;
  initialMessages: ThreadMessageLike[];
  resumeStream: ReturnType<typeof createRemoteChatResumeStream> | null;
};

export const unstable_settings = {
  anchor: '(app)',
};

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Already prevented / unavailable in some environments.
});

function RootNavigator() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { status: phoneStatus } = usePhoneGate();
  const { tagConfigured } = useAuthGate();
  const { completed: onboardingCompleted } = useOnboardingGate();
  const segments = useSegments();
  const { isDark, colors } = useTheme();
  const isPhoneSetup = segments[0] === 'auth' && String(segments[1]) === 'add-phone';
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
      {onboardingCompleted && authLoaded && !isSignedIn ? (
        <Redirect href={'/auth' as Href} />
      ) : null}
      {onboardingCompleted &&
      isSignedIn &&
      phoneStatus !== 'loading' &&
      !tagConfigured &&
      phoneStatus === 'required' &&
      !isPhoneSetup ? (
        <Redirect href={'/auth/add-phone' as Href} />
      ) : null}
      {onboardingCompleted && isSignedIn && phoneStatus === 'verified' && !tagConfigured ? (
        <Redirect href={'/auth/choose-tag' as Href} />
      ) : null}
      {onboardingCompleted &&
      isSignedIn &&
      tagConfigured &&
      segments[0] === 'auth' &&
      !isPhoneSetup ? (
        <Redirect href={'/(app)' as Href} />
      ) : null}
      <StatusBar style='auto' />
    </ThemeProvider>
  );
}

function FinoraAssistantRuntime({ remoteChat }: { remoteChat: RemoteChatRuntime | null }) {
  const runtime = useLocalRuntime((remoteChat?.adapter ?? finoraChatAdapter) as never, {
    initialMessages: remoteChat?.initialMessages,
  });
  const resumeStarted = useRef(false);

  useEffect(() => {
    if (!remoteChat?.resumeStream || resumeStarted.current) return;
    resumeStarted.current = true;
    runtime.thread.resumeRun({
      parentId: remoteChat.initialMessages.at(-1)?.id ?? null,
      stream: remoteChat.resumeStream,
    });
  }, [remoteChat, runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <PreparePaymentToolUI />
      <FundAccountToolUI />
      <ListReceiveMethodsToolUI />
      <CreatePaymentRequestToolUI />
      <GeneratePaymentLinkToolUI />
      <GetBalancesToolUI />
      <PrepareConversionToolUI />
      <PrepareInternalTransferToolUI />
      <ListInvoicesToolUI />
      <ListCalendarDuesToolUI />
      <ListSmsRequestsToolUI />
      <ListEmployeesToolUI />
      <ListSuppliersToolUI />
      <ListBeneficiariesToolUI />
      <ListPoliciesToolUI />
      <ListAutomationsToolUI />
      <ListExpensesToolUI />
      <ListVirtualAccountsToolUI />
      <TreasuryOverviewToolUI />
      <FinancialReportToolUI />
      <PreparePayrollToolUI />
      <PrepareSupplierPaymentToolUI />
      <PrepareEmployeePaymentToolUI />
      <CreateEmployeeToolUI />
      <PrepareRecurringToolUI />
      <SchedulePaymentWizardToolUI />
      <ResolveSendToolUI />
      <CreateFinancialPlanToolUI />
      <CreateVirtualCardToolUI />
      <ListVirtualCardsToolUI />
      <GetVirtualCardToolUI />
      <RootNavigator />
      <VirtualCardIssuedPopup />
    </AssistantRuntimeProvider>
  );
}

function RootApp() {
  const { getToken, isLoaded: clerkLoaded, userId } = useAuth();
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const [boot, setBoot] = useState<{
    onboardingCompleted: boolean;
    tagConfigured: boolean;
    userId: string | null;
    remoteChat: RemoteChatRuntime | null;
  } | null>(null);
  const bootReady = fontsLoaded && clerkLoaded && boot !== null && boot.userId === (userId ?? null);
  const { showOverlay, reducedMotion, progress, overlayOpacity, onOverlayLayout } =
    useSplashGate(bootReady);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remoteChatPromise = (async (): Promise<RemoteChatRuntime | null> => {
        const apiUrl = getApiUrl();
        if (env.EXPO_PUBLIC_REMOTE_CHAT_ENABLED !== 'true' || !apiUrl || !userId) return null;

        const chatId = `mobile_${userId.replaceAll(/[^A-Za-z0-9_-]/g, '_')}`;
        const config = { apiUrl, chatId, getToken };
        const adapter = createRemoteChatAdapter(config);
        try {
          const bootstrap = await loadRemoteChatBootstrap(config);
          return {
            adapter,
            initialMessages: bootstrap.initialMessages,
            resumeStream: bootstrap.activeStreamId
              ? createRemoteChatResumeStream(config, bootstrap.activeStreamId)
              : null,
          };
        } catch {
          return { adapter, initialMessages: [], resumeStream: null };
        }
      })();
      const [onboarding, tagConfigured, remoteChat] = await Promise.all([
        getOnboardingState(),
        getTagConfigured(userId),
        remoteChatPromise,
      ]);
      if (cancelled) return;
      if (onboarding.accountType) setAccountType(onboarding.accountType);
      setBoot({
        onboardingCompleted: onboarding.completed,
        tagConfigured,
        userId: userId ?? null,
        remoteChat,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, userId]);

  // Keep a stable root so the splash overlay can mount + lay out before native hide.
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND }}>
      {!bootReady || boot === null ? (
        <SplashPlaceholder />
      ) : (
        <SettingsProvider>
          <AuthGateProvider tagConfigured={boot.tagConfigured}>
            <OnboardingGateProvider completed={boot.onboardingCompleted}>
              <PhoneGateProvider key={boot.userId ?? 'signed-out'}>
                <ProfileSyncBridge />
                <FinoraAssistantRuntime
                  key={boot.remoteChat ? (boot.userId ?? 'remote') : 'local'}
                  remoteChat={boot.remoteChat}
                />
              </PhoneGateProvider>
            </OnboardingGateProvider>
          </AuthGateProvider>
        </SettingsProvider>
      )}
      {showOverlay ? (
        <SplashOverlay
          progress={progress}
          opacity={overlayOpacity}
          reducedMotion={reducedMotion}
          onLayout={onOverlayLayout}
        />
      ) : null}
      {/* Covers UI in App Switcher / Recents so balances aren't previewed. */}
      <AppSwitcherPrivacy />
    </GestureHandlerRootView>
  );
}

function ProfileSyncBridge() {
  useProfileSync();
  return null;
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
    >
      <RootApp />
    </ClerkProvider>
  );
}
