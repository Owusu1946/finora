import {
  AssistantRuntimeProvider,
  useAui,
  useAuiEvent,
  useLocalRuntime,
  useRemoteThreadListRuntime,
  useAuiState,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { createFinoraChatAdapter } from '@/lib/chat-adapter';
import { env } from '@/lib/env';
import { OnboardingGateProvider, useOnboardingGate } from '@/lib/onboarding-gate';
import { getOnboardingState } from '@/lib/onboarding-storage';
import { PasscodeGateProvider, usePasscodeGate } from '@/lib/passcode-gate';
import { hasPasscode } from '@/lib/passcode-storage';
import { PhoneGateProvider, usePhoneGate } from '@/lib/phone-gate';
import {
  createRemoteThreadAdapter,
  createRemoteThreadRuntimeAdapters,
  firstThreadUserText,
  requestRemoteThreadTitle,
  type RemoteThreadConfig,
} from '@/lib/remote-thread-adapter';
import { SettingsProvider } from '@/lib/settings-context';
import { useDrainPendingPaymentLink } from '@/lib/use-drain-pending-payment-link';
import { useProfileSync } from '@/lib/use-profile-sync';

const publishableKey = env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

type RemoteChatRuntime = RemoteThreadConfig;

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
  const { locked: passcodeLocked } = usePasscodeGate();
  const { completed: onboardingCompleted } = useOnboardingGate();
  const segments = useSegments();
  const { isDark, colors } = useTheme();
  const isAuthSubScreen =
    segments[0] === 'auth' &&
    (String(segments[1]) === 'add-phone' ||
      String(segments[1]) === 'create-passcode' ||
      String(segments[1]) === 'enter-passcode');
  const isEnterPasscodeScreen = segments[0] === 'auth' && String(segments[1]) === 'enter-passcode';
  const requiresPasscode =
    onboardingCompleted && authLoaded && isSignedIn && tagConfigured && passcodeLocked;
  const concealProtectedContent =
    Boolean(isSignedIn) &&
    ((requiresPasscode && !isEnterPasscodeScreen) || (!tagConfigured && phoneStatus === 'loading'));
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
      {onboardingCompleted && authLoaded && !isSignedIn && segments[0] !== 'auth' ? (
        <Redirect href={'/auth' as Href} />
      ) : null}
      {onboardingCompleted &&
      isSignedIn &&
      phoneStatus !== 'loading' &&
      !tagConfigured &&
      phoneStatus === 'required' &&
      !isAuthSubScreen ? (
        <Redirect href={'/auth/add-phone' as Href} />
      ) : null}
      {onboardingCompleted && isSignedIn && phoneStatus === 'verified' && !tagConfigured ? (
        <Redirect href={'/auth/choose-tag' as Href} />
      ) : null}
      {requiresPasscode && !isEnterPasscodeScreen ? (
        <Redirect href={'/auth/enter-passcode' as Href} />
      ) : null}
      {onboardingCompleted &&
      isSignedIn &&
      tagConfigured &&
      segments[0] === 'auth' &&
      !isAuthSubScreen ? (
        <Redirect href={'/(app)' as Href} />
      ) : null}
      {concealProtectedContent ? (
        <View
          pointerEvents='auto'
          style={[styles.securityCover, { backgroundColor: colors.background }]}
        />
      ) : null}
      <StatusBar style='auto' />
    </ThemeProvider>
  );
}

function InstantRemoteTitleSync({ config }: { config: RemoteThreadConfig }) {
  const aui = useAui();
  const startedRef = useRef(new Set<string>());

  useAuiEvent('thread.runStart', () => {
    void (async () => {
      const messages = aui.thread().getState().messages;
      if (messages.filter((message) => message.role === 'user').length !== 1) return;
      const message = firstThreadUserText(messages);
      if (!message) return;

      const item = aui.threadListItem.getState();
      if (item.title && item.title !== 'New chat') return;
      const remoteId = item.remoteId ?? (await aui.threadListItem.initialize()).remoteId;
      if (startedRef.current.has(remoteId)) return;
      startedRef.current.add(remoteId);

      // assistant-ui normally generates titles on runEnd. Trigger it now so
      // the deterministic local title reaches the drawer before the model responds.
      aui.threadListItem.generateTitle();
      const generated = await requestRemoteThreadTitle(config, remoteId, message);
      if (generated) aui.threadListItem.generateTitle();
    })();
  });

  return null;
}

function FinoraRuntimeContent({
  runtime,
  remoteConfig,
}: {
  runtime: ReturnType<typeof useLocalRuntime>;
  remoteConfig?: RemoteThreadConfig;
}) {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {remoteConfig ? <InstantRemoteTitleSync config={remoteConfig} /> : null}
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

function LocalFinoraAssistantRuntime({ getToken }: { getToken: () => Promise<string | null> }) {
  const adapter = useMemo(() => createFinoraChatAdapter(getToken), [getToken]);
  const runtime = useLocalRuntime(adapter);
  return <FinoraRuntimeContent runtime={runtime} />;
}

function RemoteFinoraAssistantRuntime({ config }: { config: RemoteChatRuntime }) {
  const threadListAdapter = useMemo(
    () => createRemoteThreadAdapter(config),
    [config.apiUrl, config.getToken, config.userId],
  );
  const runtime = useRemoteThreadListRuntime({
    adapter: threadListAdapter,
    runtimeHook: function RemoteThreadRuntimeHook() {
      const remoteId = useAuiState((state) => state.threadListItem.remoteId);
      const adapters = useMemo(
        () => createRemoteThreadRuntimeAdapters(config, remoteId ?? 'pending'),
        [remoteId],
      );
      return useLocalRuntime(adapters.chatModel, { adapters: { history: adapters.history } });
    },
  });
  return (
    <FinoraRuntimeContent
      runtime={runtime}
      remoteConfig={config}
    />
  );
}

function FinoraAssistantRuntime({
  remoteChat,
  getToken,
}: {
  remoteChat: RemoteChatRuntime | null;
  getToken: () => Promise<string | null>;
}) {
  return remoteChat ? (
    <RemoteFinoraAssistantRuntime config={remoteChat} />
  ) : (
    <LocalFinoraAssistantRuntime getToken={getToken} />
  );
}

function RootApp() {
  const { getToken, isLoaded: clerkLoaded, userId } = useAuth();
  // Clerk may provide a new function identity while its session refreshes. Keep the
  // callback passed into the remote runtime stable so the thread-list adapter (and
  // its request cache) is not recreated on every auth render.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const stableGetToken = useCallback(() => getTokenRef.current(), []);
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const [boot, setBoot] = useState<{
    onboardingCompleted: boolean;
    tagConfigured: boolean;
    passcodeExists: boolean;
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
        return { apiUrl, userId, getToken: stableGetToken };
      })();
      const [onboarding, tagConfigured, passcodeExists, remoteChat] = await Promise.all([
        getOnboardingState(),
        getTagConfigured(userId),
        hasPasscode(),
        remoteChatPromise,
      ]);
      if (cancelled) return;
      if (onboarding.accountType) setAccountType(onboarding.accountType);
      setBoot({
        onboardingCompleted: onboarding.completed,
        tagConfigured,
        passcodeExists,
        userId: userId ?? null,
        remoteChat,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [stableGetToken, userId]);

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
                <PasscodeGateProvider
                  key={boot.userId ?? 'signed-out'}
                  initiallyLocked={Boolean(
                    boot.userId && boot.tagConfigured && boot.passcodeExists,
                  )}
                >
                  <ProfileSyncBridge />
                  <FinoraAssistantRuntime
                    key={boot.remoteChat ? (boot.userId ?? 'remote') : 'local'}
                    remoteChat={boot.remoteChat}
                    getToken={stableGetToken}
                  />
                </PasscodeGateProvider>
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

const styles = StyleSheet.create({
  securityCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    elevation: 90,
  },
});

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
