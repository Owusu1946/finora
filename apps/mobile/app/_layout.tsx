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
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Redirect,
  Stack,
  ThemeProvider,
  useSegments,
  type Href,
  type Theme,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import '../global.css';

import { VirtualCardIssuedPopup } from '@/components/cards/VirtualCardIssuedPopup';
import {
  AutomationReadyToolUI,
  CreateAutomationToolUI,
  ManageAutomationToolUI,
} from '@/components/chat/AutomationToolUIs';
import { ConnectFallbackToolUIs } from '@/components/chat/ConnectFallbackToolUIs';
import { CreateEmployeeToolUI } from '@/components/chat/CreateEmployeeToolUI';
import { CreateFinancialPlanToolUI } from '@/components/chat/CreateFinancialPlanToolUI';
import {
  CreatePaymentRequestToolUI,
  GeneratePaymentLinkToolUI,
} from '@/components/chat/CreatePaymentRequestToolUI';
import { CreateVirtualCardToolUI } from '@/components/chat/CreateVirtualCardToolUI';
import { DraftWhatsAppMessageToolUI } from '@/components/chat/DraftWhatsAppMessageToolUI';
import { FinancialReportToolUI } from '@/components/chat/FinancialReportToolUI';
import { FundAccountToolUI } from '@/components/chat/FundAccountToolUI';
import { GetBalancesToolUI } from '@/components/chat/GetBalancesToolUI';
import { GetVirtualCardToolUI } from '@/components/chat/GetVirtualCardToolUI';
import {
  DraftPayrollToolUI,
  InspectPayrollAttachmentToolUI,
} from '@/components/chat/InspectPayrollAttachmentToolUI';
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
import { PrepareInternalTransferToolUI } from '@/components/chat/PrepareInternalTransferToolUI';
import { PreparePaymentToolUI } from '@/components/chat/PreparePaymentToolUI';
import {
  PrepareEmployeePaymentToolUI,
  PreparePayrollToolUI,
} from '@/components/chat/PreparePayrollToolUI';
import { PrepareRecurringToolUI } from '@/components/chat/PrepareRecurringToolUI';
import { PrepareSupplierPaymentToolUI } from '@/components/chat/PrepareSupplierPaymentToolUI';
import { ProposePayrollChangesToolUI } from '@/components/chat/ProposePayrollChangesToolUI';
import { ResolveSendToolUI } from '@/components/chat/ResolveSendToolUI';
import { SchedulePaymentWizardToolUI } from '@/components/chat/SchedulePaymentWizardToolUI';
import { SuggestAppConnectionToolUI } from '@/components/chat/SuggestAppConnectionToolUI';
import { TreasuryOverviewToolUI } from '@/components/chat/TreasuryOverviewToolUI';
import {
  ResearchWebToolUI,
  SearchProductsToolUI,
  SearchWebToolUI,
} from '@/components/chat/WebSearchToolUI';
import { AppSwitcherPrivacy } from '@/components/privacy/AppSwitcherPrivacy';
import { SplashOverlay, SplashPlaceholder } from '@/components/splash/SplashOverlay';
import { useSplashGate } from '@/components/splash/useSplashGate';
import { OpenThreadBridge } from '@/components/thread-list/OpenThreadBridge';
import { SPLASH_BACKGROUND } from '@/components/ui/finora-mark-paths';
import { useTheme } from '@/hooks/use-theme';
import { setAccountType } from '@/lib/account';
import { getApiUrl } from '@/lib/api-url';
import { AuthGateProvider, useAuthGate } from '@/lib/auth-gate';
import { getTagConfigured } from '@/lib/auth-storage';
import { AutomationNotificationBridge } from '@/lib/automation-notifications';
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
  hasGeneratedTitle,
  requestRemoteThreadTitle,
  threadTitleExchange,
  type RemoteThreadConfig,
} from '@/lib/remote-thread-adapter';
import { setActiveUserId } from '@/lib/session-storage';
import { SettingsProvider } from '@/lib/settings-context';
import { useClerkUserRefresh } from '@/lib/use-clerk-user-refresh';
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

function StatusBarBackdrop() {
  const { top } = useSafeAreaInsets();

  if (top === 0) return null;

  return (
    <BlurView
      pointerEvents='none'
      intensity={40}
      tint='systemChromeMaterial'
      className='absolute inset-x-0 top-0 z-[80] overflow-hidden'
      style={{ height: top }}
    />
  );
}

function RootNavigator() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { status: phoneStatus } = usePhoneGate();
  const { tagConfigured } = useAuthGate();
  const { enabled: passcodeEnabled, lock, locked: passcodeLocked } = usePasscodeGate();
  const { completed: onboardingCompleted } = useOnboardingGate();
  const [firstSegment, ...remainingSegments] = useSegments();
  const [secondSegment] = remainingSegments as string[];
  const { isDark, colors } = useTheme();
  const isAuthSubScreen =
    firstSegment === 'auth' &&
    (secondSegment === 'add-phone' ||
      secondSegment === 'create-passcode' ||
      secondSegment === 'enter-passcode');
  const isEnterPasscodeScreen = firstSegment === 'auth' && secondSegment === 'enter-passcode';
  const requiresPasscode =
    onboardingCompleted &&
    authLoaded &&
    isSignedIn &&
    tagConfigured &&
    passcodeEnabled &&
    passcodeLocked;
  const concealProtectedContent =
    Boolean(isSignedIn) &&
    ((requiresPasscode && !isEnterPasscodeScreen) || (!tagConfigured && phoneStatus === 'loading'));
  useDrainPendingPaymentLink();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // Lock only when the app fully leaves the foreground. 'inactive' also
      // fires for OS pulls (notification shade, Control Center, app switcher
      // peek), which must not invalidate the session.
      if (state === 'background') lock();
    });
    return () => subscription.remove();
  }, [lock]);
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
      {onboardingCompleted && authLoaded && !isSignedIn && firstSegment !== 'auth' ? (
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
      firstSegment === 'auth' &&
      !isAuthSubScreen ? (
        <Redirect href={'/(app)' as Href} />
      ) : null}
      {concealProtectedContent ? (
        <View
          pointerEvents='auto'
          className='absolute inset-0 z-[90] bg-background'
          style={{ elevation: 90 }}
        />
      ) : null}
      <StatusBar style='auto' />
    </ThemeProvider>
  );
}

/** Stop asking for a title once a chat is this many turns in without a topic. */
const MAX_TITLE_TURNS = 3;

/**
 * Titles chats started in this session. The local fallback shows the instant a
 * message is sent (the runtime's own title pass); this then asks the API for a
 * real title as soon as the run starts, from the message alone, so it types in
 * while the reply streams. If the opening had no topic (small talk), it retries
 * when the run ends with the reply for context, for up to three turns.
 */
function InstantRemoteTitleSync({ config }: { config: RemoteThreadConfig }) {
  const aui = useAui();
  const generatingRef = useRef(new Set<string>());
  // Only chats started here get titled, so chats loaded from history keep theirs.
  const newChatsRef = useRef(new Set<string>());

  const requestTitle = async (withReply: boolean) => {
    const messages = aui.thread().getState().messages;
    const userTurns = messages.filter((message) => message.role === 'user').length;
    if (userTurns === 0 || userTurns > MAX_TITLE_TURNS) return;

    const item = aui.threadListItem.getState();
    const remoteId = item.remoteId ?? (await aui.threadListItem.initialize()).remoteId;
    if (userTurns === 1 && !withReply) newChatsRef.current.add(remoteId);
    if (!newChatsRef.current.has(remoteId)) return;
    if (hasGeneratedTitle(remoteId) || generatingRef.current.has(remoteId)) return;

    const exchange = threadTitleExchange(messages);
    if (!exchange.message) return;
    generatingRef.current.add(remoteId);
    requestRemoteThreadTitle(config, remoteId, withReply ? exchange : { message: exchange.message })
      .then((generated) => {
        if (generated) aui.threadListItem.generateTitle();
      })
      .finally(() => {
        generatingRef.current.delete(remoteId);
      });
  };

  useAuiEvent('thread.runStart', () => void requestTitle(false));
  useAuiEvent('thread.runEnd', () => void requestTitle(true));

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
      <OpenThreadBridge />
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
      <CreateAutomationToolUI />
      <ManageAutomationToolUI />
      <AutomationReadyToolUI />
      <ListExpensesToolUI />
      <ListVirtualAccountsToolUI />
      <TreasuryOverviewToolUI />
      <FinancialReportToolUI />
      <InspectPayrollAttachmentToolUI />
      <DraftPayrollToolUI />
      <PreparePayrollToolUI />
      <ProposePayrollChangesToolUI />
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
      <SuggestAppConnectionToolUI />
      <DraftWhatsAppMessageToolUI />
      <ConnectFallbackToolUIs />
      <SearchWebToolUI />
      <SearchProductsToolUI />
      <ResearchWebToolUI />
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
  const runtimeConfig = useMemo(
    () => ({
      apiUrl: config.apiUrl,
      getToken: config.getToken,
      userId: config.userId,
    }),
    [config.apiUrl, config.getToken, config.userId],
  );
  const threadListAdapter = useMemo(
    () => createRemoteThreadAdapter(runtimeConfig),
    [runtimeConfig],
  );
  const runtime = useRemoteThreadListRuntime({
    adapter: threadListAdapter,
    runtimeHook: function RemoteThreadRuntimeHook() {
      const localThreadId = useAuiState((state) => state.threadListItem.id);
      const remoteId = useAuiState((state) => state.threadListItem.remoteId);
      const adapters = useMemo(
        () => createRemoteThreadRuntimeAdapters(runtimeConfig, localThreadId ?? null),
        // The memoized config object carries the complete remote adapter identity.
        // The hooks rule cannot model that object identity through its properties.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [localThreadId, runtimeConfig.apiUrl, runtimeConfig.getToken, runtimeConfig.userId],
      );

      useEffect(() => {
        if (remoteId) adapters.bindRemoteId(remoteId);
        return () => adapters.release();
      }, [adapters, remoteId]);

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
  const [storageUserId, setStorageUserId] = useState<string | null | undefined>(undefined);
  const bootReady =
    fontsLoaded &&
    clerkLoaded &&
    storageUserId !== undefined &&
    boot !== null &&
    boot.userId === (userId ?? null);
  const { showOverlay, reducedMotion, progress, overlayOpacity, onOverlayLayout } =
    useSplashGate(bootReady);

  useEffect(() => {
    let cancelled = false;
    setStorageUserId(undefined);
    setBoot(null);
    void (async () => {
      await setActiveUserId(userId ?? null);
      if (cancelled) return;
      setStorageUserId(userId ?? null);
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
      setAccountType(onboarding.accountType ?? 'personal');
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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND }}>
      {storageUserId !== undefined ? (
        <SettingsProvider key={storageUserId ?? 'signed-out'}>
          {!bootReady || boot === null ? (
            <SplashPlaceholder />
          ) : (
            <AuthGateProvider tagConfigured={boot.tagConfigured}>
              <OnboardingGateProvider completed={boot.onboardingCompleted}>
                <PhoneGateProvider key={boot.userId ?? 'signed-out'}>
                  <PasscodeGateProvider
                    key={boot.userId ?? 'signed-out'}
                    enabled={boot.passcodeExists}
                    initiallyLocked={Boolean(
                      boot.userId && boot.tagConfigured && boot.passcodeExists,
                    )}
                  >
                    <ProfileSyncBridge />
                    <AutomationNotificationBridge />
                    <FinoraAssistantRuntime
                      key={boot.remoteChat ? (boot.userId ?? 'remote') : 'local'}
                      remoteChat={boot.remoteChat}
                      getToken={stableGetToken}
                    />
                  </PasscodeGateProvider>
                </PhoneGateProvider>
              </OnboardingGateProvider>
            </AuthGateProvider>
          )}
          {showOverlay ? (
            <SplashOverlay
              progress={progress}
              opacity={overlayOpacity}
              reducedMotion={reducedMotion}
              onLayout={onOverlayLayout}
            />
          ) : null}
          <StatusBarBackdrop />
          {/* Covers UI in App Switcher / Recents so balances aren't previewed. */}
          <AppSwitcherPrivacy />
        </SettingsProvider>
      ) : (
        <SplashPlaceholder />
      )}
    </GestureHandlerRootView>
  );
}

function ProfileSyncBridge() {
  useProfileSync();
  useClerkUserRefresh();
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
