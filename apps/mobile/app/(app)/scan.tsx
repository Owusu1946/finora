import { useAui } from '@assistant-ui/react-native';
import { useAuth, useUser } from '@clerk/expo';
import { useHeaderHeight } from '@react-navigation/elements';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { ReceiveMethod } from '@/components/chat/ReceiveMoneyCard';

import { MockQrCode } from '@/components/chat/MockQrCode';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { SwipeBackView } from '@/components/navigation/swipe-back-view';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { buildScanPayPrompt, parsePaymentQr, type ParsedPaymentQr } from '@/lib/payment-qr';
import { ensureMediaLibraryPermission, ensureSaveToLibraryPermission } from '@/lib/permissions';
import { buildPersonalReceiveMethod } from '@/lib/personal-qr';
import { getUserProfile } from '@/lib/profile-api';
import { sendChatPrompt } from '@/lib/send-chat-prompt';

const AMOUNTS = [25, 50, 100, 250, 500];
const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR', 'USDT'];

type Phase = 'scan' | 'my-code' | 'payload' | 'amount';
type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; profile: Awaited<ReturnType<typeof getUserProfile>> };

type QrActionState = {
  busy: boolean;
  status: string | null;
  error: string | null;
};

const QR_ACTION_IDLE: QrActionState = { busy: false, status: null, error: null };

function qrActionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'That action did not complete. Please try again.';
}

export default function ScanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
  const { getToken } = useAuth();
  const { user } = useUser();
  const getTokenRef = useRef(getToken);
  const headerHeight = useHeaderHeight();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scan');
  const [parsed, setParsed] = useState<ParsedPaymentQr | null>(null);
  const [locked, setLocked] = useState(false);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState('GHS');
  const [customAmount, setCustomAmount] = useState('');
  const [profileState, setProfileState] = useState<ProfileState>({ status: 'idle' });

  getTokenRef.current = getToken;

  useEffect(() => {
    setProfileState({ status: user?.id ? 'loading' : 'idle' });
    if (!user?.id) return;

    let currentUserId: string | null = user.id;
    void getUserProfile(() => getTokenRef.current())
      .then((next) => {
        if (currentUserId === user.id) setProfileState({ status: 'ready', profile: next });
      })
      .catch(() => {
        if (currentUserId === user.id) setProfileState({ status: 'error' });
      });
  }, [user?.id]);

  const personalMethod = useMemo(
    () =>
      profileState.status === 'ready'
        ? buildPersonalReceiveMethod({
            displayName: profileState.profile.displayName,
            phoneNumber: profileState.profile.phoneNumber,
            phoneVerifiedAt: profileState.profile.phoneVerifiedAt,
          })
        : null,
    [profileState],
  );

  const loadPersonalProfile = useCallback(() => {
    const userId = user?.id;
    if (!userId) return;
    haptics.selection();
    setProfileState({ status: 'loading' });
    void getUserProfile(() => getTokenRef.current())
      .then((next) => {
        if (user?.id === userId) setProfileState({ status: 'ready', profile: next });
      })
      .catch(() => {
        if (user?.id === userId) setProfileState({ status: 'error' });
      });
  }, [user?.id]);

  const finishPay = useCallback(
    (qr: ParsedPaymentQr, payAmount: number, payCurrency: string) => {
      const prompt = buildScanPayPrompt({ ...qr, currency: payCurrency }, payAmount);
      router.replace('/');
      setTimeout(() => {
        sendChatPrompt(aui, prompt);
      }, 80);
    },
    [aui, router],
  );

  const applyPayload = useCallback(
    (raw: string) => {
      const next = parsePaymentQr(raw);
      if (!next) {
        haptics.error();
        setError('Not a Finora payment QR. Try a receive or payment-request code.');
        setLocked(false);
        return;
      }
      haptics.success();
      setError(null);
      setParsed(next);
      setCurrency(next.currency);
      if (next.amount != null && !next.needsAmount) {
        finishPay(next, next.amount, next.currency);
        return;
      }
      setPhase('amount');
    },
    [finishPay],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (locked || phase !== 'scan') return;
      setLocked(true);
      applyPayload(data);
    },
    [applyPayload, locked, phase],
  );

  const onPasteSubmit = () => {
    if (!paste.trim()) return;
    applyPayload(paste.trim());
  };

  const openPayloadEntry = () => {
    haptics.selection();
    setError(null);
    setLocked(false);
    setPhase('payload');
  };

  const openScanner = () => {
    haptics.selection();
    setError(null);
    setLocked(false);
    setPhase('scan');
  };

  const openMyCode = () => {
    haptics.selection();
    setError(null);
    setPhase('my-code');
  };

  const scanFromLibrary = async () => {
    haptics.selection();
    const hasPermission = await ensureMediaLibraryPermission(
      'Allow photo access in Settings to choose a QR image.',
    );
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setLocked(true);
    setError(null);
    const codes = await scanFromURLAsync(result.assets[0].uri, ['qr']);
    if (!codes[0]?.data) {
      haptics.error();
      setError('No QR code found in that image. Try another photo.');
      setLocked(false);
      return;
    }
    applyPayload(codes[0].data);
  };

  const onContinueAmount = () => {
    if (!parsed || amount == null || amount <= 0) return;
    haptics.selection();
    finishPay(parsed, amount, currency);
  };

  let content: ReactNode;

  if (Platform.OS === 'web') {
    content = (
      <>
        {phase === 'amount' && parsed ? (
          <AmountStep
            parsed={parsed}
            amount={amount}
            setAmount={setAmount}
            currency={currency}
            setCurrency={setCurrency}
            customAmount={customAmount}
            setCustomAmount={setCustomAmount}
            onContinue={onContinueAmount}
            onBack={() => {
              setPhase('scan');
              setParsed(null);
              setLocked(false);
            }}
          />
        ) : (
          <PasteBlock
            paste={paste}
            setPaste={setPaste}
            onSubmit={onPasteSubmit}
            error={error}
          />
        )}
      </>
    );
  } else if (phase === 'my-code') {
    if (personalMethod) {
      content = (
        <MyCodeStep
          method={personalMethod}
          onBack={openScanner}
        />
      );
    } else if (profileState.status === 'error') {
      content = (
        <>
          <WizardStepHeader
            step={1}
            total={1}
            title='Could not load your code'
            subtitle='Check your connection, then try again.'
          />
          <Pressable
            onPress={loadPersonalProfile}
            style={[styles.primaryBtn, { backgroundColor: colors.foreground }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>Retry</Text>
          </Pressable>
          <Pressable
            onPress={openScanner}
            style={styles.linkBtn}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Scan QR</Text>
          </Pressable>
        </>
      );
    } else if (profileState.status === 'loading') {
      content = (
        <>
          <WizardStepHeader
            step={1}
            total={1}
            title='Loading your code'
            subtitle='Checking your verified mobile-money profile.'
          />
          <Pressable
            onPress={openScanner}
            style={styles.linkBtn}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Scan QR</Text>
          </Pressable>
        </>
      );
    } else {
      content = (
        <>
          <WizardStepHeader
            step={1}
            total={1}
            title='Verify your phone'
            subtitle='Your personal receive code needs a verified mobile-money number.'
          />
          <Pressable
            onPress={openScanner}
            style={[styles.primaryBtn, { backgroundColor: colors.foreground }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>Back to scan</Text>
          </Pressable>
        </>
      );
    }
  } else if (phase === 'payload') {
    content = (
      <>
        <PasteBlock
          paste={paste}
          setPaste={setPaste}
          onSubmit={onPasteSubmit}
          error={error}
          onScanQr={permission?.granted ? openScanner : undefined}
        />
      </>
    );
  } else if (!permission) {
    return <View style={[styles.screen, { backgroundColor: colors.background }]} />;
  } else if (!permission.granted) {
    content = (
      <>
        <WizardStepHeader
          step={1}
          total={1}
          title='Camera access'
          subtitle='Finora needs the camera to scan payment QR codes.'
        />
        <Pressable
          onPress={() => {
            haptics.selection();
            void requestPermission();
          }}
          style={[styles.primaryBtn, { backgroundColor: colors.foreground }]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.background }]}>Allow camera</Text>
        </Pressable>
        <Pressable
          onPress={openPayloadEntry}
          style={styles.linkBtn}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Enter payload instead</Text>
        </Pressable>
        {user?.id ? (
          <Pressable
            onPress={openMyCode}
            style={styles.linkBtn}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Show my code</Text>
          </Pressable>
        ) : null}
      </>
    );
  } else if (phase === 'amount' && parsed) {
    content = (
      <>
        <AmountStep
          parsed={parsed}
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          customAmount={customAmount}
          setCustomAmount={setCustomAmount}
          onContinue={onContinueAmount}
          onBack={() => {
            haptics.selection();
            setPhase('scan');
            setParsed(null);
            setLocked(false);
            setError(null);
          }}
        />
      </>
    );
  } else {
    content = (
      <View style={[styles.scannerShell, { backgroundColor: colors.background }]}>
        <View style={styles.scannerTop}>
          <Text style={[styles.scannerTitle, { color: colors.foreground }]}>Scan to pay</Text>
          <Text style={[styles.scannerSubtitle, { color: colors.mutedForeground }]}>
            Point at a Finora QR code
          </Text>
        </View>
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing='back'
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={locked ? undefined : onBarcodeScanned}
          />
          <View
            style={styles.reticle}
            pointerEvents='none'
          >
            <View style={[styles.reticleCorner, styles.tl, { borderColor: colors.foreground }]} />
            <View style={[styles.reticleCorner, styles.tr, { borderColor: colors.foreground }]} />
            <View style={[styles.reticleCorner, styles.bl, { borderColor: colors.foreground }]} />
            <View style={[styles.reticleCorner, styles.br, { borderColor: colors.foreground }]} />
          </View>
        </View>
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        <View style={styles.scannerActions}>
          <View style={styles.scannerActionStart}>
            <Pressable
              accessibilityLabel='Choose QR from photo library'
              onPress={() => void scanFromLibrary()}
              style={[styles.scannerIconButton, { backgroundColor: colors.muted }]}
            >
              <Icon
                name='image'
                size={22}
                color={colors.foreground}
              />
            </Pressable>
          </View>
          <Pressable
            onPress={openPayloadEntry}
            style={[styles.primaryPillButton, { backgroundColor: colors.foreground }]}
          >
            <Text style={[styles.myCodeText, { color: colors.background }]}>Enter payload</Text>
          </Pressable>
          <View style={styles.scannerActionEnd}>
            {user?.id ? (
              <Pressable
                accessibilityLabel='Show my receive QR code'
                onPress={openMyCode}
                style={[styles.scannerIconButton, { backgroundColor: colors.muted }]}
              >
                <Icon
                  name='qr'
                  size={22}
                  color={colors.foreground}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (phase === 'scan' && Platform.OS !== 'web') {
    return (
      <SwipeBackView>
        <View style={[styles.flex, { backgroundColor: colors.background }]}>{content}</View>
      </SwipeBackView>
    );
  }

  return (
    <SwipeBackView>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={
            Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
          }
          keyboardVerticalOffset={headerHeight}
        >
          <ScrollView
            contentContainerStyle={styles.screenContent}
            contentInsetAdjustmentBehavior='automatic'
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SwipeBackView>
  );
}

function AmountStep({
  parsed,
  amount,
  setAmount,
  currency,
  setCurrency,
  customAmount,
  setCustomAmount,
  onContinue,
  onBack,
}: {
  parsed: ParsedPaymentQr;
  amount: number | null;
  setAmount: (n: number | null) => void;
  currency: string;
  setCurrency: (c: string) => void;
  customAmount: string;
  setCustomAmount: (t: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      <WizardStepHeader
        step={2}
        total={2}
        title='How much to send?'
        subtitle={`${parsed.destination.label} · ${parsed.destination.value}`}
      />
      <View style={styles.chips}>
        {CURRENCIES.map((c) => (
          <WizardChip
            key={c}
            label={c}
            selected={currency === c}
            onPress={() => setCurrency(c)}
          />
        ))}
      </View>
      <View style={styles.chips}>
        {AMOUNTS.map((n) => (
          <WizardChip
            key={n}
            label={String(n)}
            selected={amount === n && !customAmount}
            onPress={() => {
              setAmount(n);
              setCustomAmount('');
            }}
          />
        ))}
      </View>
      <TextInput
        value={customAmount}
        onChangeText={(t) => {
          setCustomAmount(t);
          const n = Number(t.replace(/,/g, ''));
          setAmount(Number.isFinite(n) && n > 0 ? n : null);
        }}
        keyboardType='decimal-pad'
        placeholder='Custom amount'
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.composer,
          },
        ]}
      />
      <Pressable
        onPress={onContinue}
        disabled={amount == null || amount <= 0}
        style={[
          styles.primaryBtn,
          {
            backgroundColor: colors.foreground,
            opacity: amount == null || amount <= 0 ? 0.4 : 1,
          },
        ]}
      >
        <Text style={[styles.primaryBtnText, { color: colors.background }]}>
          Continue to confirm
        </Text>
      </Pressable>
      <Pressable
        onPress={onBack}
        style={styles.linkBtn}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Scan again</Text>
      </Pressable>
    </>
  );
}

function MyCodeStep({ method, onBack }: { method: ReceiveMethod; onBack: () => void }) {
  const { colors, isDark } = useTheme();
  const qrRef = useRef<View>(null);
  const [actionState, setActionState] = useState(QR_ACTION_IDLE);

  const withQrAction = useCallback(
    async (action: (uri: string) => Promise<string>) => {
      if (actionState.busy) return;
      setActionState({ ...QR_ACTION_IDLE, busy: true });
      haptics.selection();

      try {
        const uri = await captureRef(qrRef, {
          format: 'png',
          quality: 1,
          width: 720,
          height: 720,
        });
        const status = await action(uri);
        haptics.success();
        setActionState({ ...QR_ACTION_IDLE, status });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setActionState({ ...QR_ACTION_IDLE, error: 'Saving was cancelled.' });
          return;
        }
        haptics.error();
        setActionState({ ...QR_ACTION_IDLE, error: qrActionErrorMessage(error) });
      }
    },
    [actionState.busy],
  );

  const shareCode = async () => {
    const message = [
      `Scan this Finora receive code for ${method.currency}.`,
      method.title,
      '',
      method.qrPayload,
      '',
      ...method.fields.map((field) => `${field.label}: ${field.value}`),
    ].join('\n');

    await withQrAction(async (qrUri) => {
      await Share.share({
        url: Platform.OS === 'ios' ? qrUri : undefined,
        message: Platform.OS === 'ios' ? message : `${message}\n${qrUri}`,
        title: `Finora QR · ${method.currency}`,
      });
      return '';
    });
  };

  const saveCode = async () => {
    await withQrAction(async (qrUri) => {
      const hasPermission = await ensureSaveToLibraryPermission();
      if (!hasPermission) throw new Error('Photo access was not granted.');
      const asset = await MediaLibrary.createAssetAsync(qrUri);
      await MediaLibrary.createAlbumAsync('Finora', asset, false).catch(() => asset);
      return 'Saved to your photo library.';
    });
  };

  return (
    <>
      <WizardStepHeader
        step={1}
        total={1}
        title='My code'
        subtitle={method.subtitle}
      />
      <View style={[styles.myCodeCard, { backgroundColor: isDark ? '#fff' : colors.background }]}>
        <MockQrCode
          ref={qrRef}
          value={method.qrPayload}
          size={230}
          color='#18181b'
          backgroundColor='#ffffff'
        />
      </View>
      <Text style={[styles.myCodeHint, { color: colors.mutedForeground }]}>
        Save or scan this code to receive GHS.
      </Text>
      {actionState.error ? (
        <Text style={[styles.actionFeedback, styles.actionError, { color: colors.destructive }]}>
          {actionState.error}
        </Text>
      ) : actionState.status ? (
        <Text style={[styles.actionFeedback, { color: colors.mutedForeground }]}>
          {actionState.status}
        </Text>
      ) : null}
      <Pressable
        onPress={() => void shareCode()}
        disabled={actionState.busy}
        style={[styles.primaryBtn, { backgroundColor: colors.foreground }]}
      >
        <Text style={[styles.primaryBtnText, { color: colors.background }]}>
          {actionState.busy ? 'Working…' : 'Share code'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void saveCode()}
        disabled={actionState.busy}
        style={[styles.secondaryBtn, { borderColor: colors.border }]}
      >
        <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Save image</Text>
      </Pressable>
      <Pressable
        onPress={onBack}
        style={styles.linkBtn}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Scan QR</Text>
      </Pressable>
    </>
  );
}

function PasteBlock({
  paste,
  setPaste,
  onSubmit,
  error,
  onScanQr,
}: {
  paste: string;
  setPaste: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  onScanQr?: () => void;
}) {
  const { colors } = useTheme();

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text) {
      haptics.error();
      return;
    }
    haptics.selection();
    setPaste(text);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      contentInsetAdjustmentBehavior='automatic'
      keyboardShouldPersistTaps='handled'
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.background }}
    >
      <View style={styles.payloadHero}>
        <View style={[styles.payloadIconWrap, { backgroundColor: colors.muted }]}>
          <Icon
            name='clipboard'
            size={24}
            color={colors.foreground}
          />
        </View>
        <Text style={[styles.payloadTitle, { color: colors.foreground }]}>Enter payload</Text>
        <Text style={[styles.payloadSubtitle, { color: colors.mutedForeground }]}>
          Paste the code or payload from a Finora receive QR or payment request.
        </Text>
      </View>
      <View style={styles.payloadInputWrap}>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          onSubmitEditing={onSubmit}
          autoCapitalize='none'
          autoCorrect={false}
          returnKeyType='go'
          placeholder='finora:momo:ghs:0550123456'
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.payloadInput,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.composer,
            },
          ]}
        />
        <Pressable
          accessibilityLabel='Paste from clipboard'
          hitSlop={8}
          onPress={() => void pasteFromClipboard()}
          style={({ pressed }) => [
            styles.clipboardBtn,
            { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Icon
            name='clipboard'
            size={19}
            color={colors.foreground}
          />
        </Pressable>
      </View>
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      <Pressable
        onPress={() => {
          haptics.selection();
          onSubmit();
        }}
        disabled={!paste.trim()}
        style={[
          styles.primaryBtn,
          { backgroundColor: colors.foreground, opacity: paste.trim() ? 1 : 0.4 },
        ]}
      >
        <Text style={[styles.primaryBtnText, { color: colors.background }]}>Use payload</Text>
      </Pressable>
      {onScanQr ? (
        <Pressable
          onPress={() => {
            haptics.selection();
            onScanQr();
          }}
          style={styles.linkBtn}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Scan QR</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  cameraWrap: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 360,
    borderRadius: 26,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#151515',
  },
  reticle: {
    ...StyleSheet.absoluteFillObject,
    margin: 48,
  },
  reticleCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
  },
  primaryBtn: {
    marginTop: 8,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    fontWeight: '700',
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  payloadLink: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  payloadLinkText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  payloadHero: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 24,
  },
  payloadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payloadTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 24,
    fontWeight: '700',
  },
  payloadSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  payloadInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  payloadInput: {
    paddingRight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
  },
  clipboardBtn: {
    position: 'absolute',
    right: 6,
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '500',
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 18,
  },
  scannerShell: {
    flex: 1,
    minHeight: 620,
    marginTop: -8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 18,
  },
  scannerTop: { gap: 4, alignItems: 'center' },
  scannerTitle: { fontFamily: 'DMSans_400Regular', fontSize: 25, fontWeight: '700' },
  scannerSubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 15 },
  scannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
  },
  scannerActionStart: { flex: 1, alignItems: 'flex-start' },
  scannerActionEnd: { flex: 1, alignItems: 'flex-end' },
  scannerIconButton: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myCodeCard: {
    alignSelf: 'center',
    padding: 14,
    borderRadius: Radius.card,
  },
  myCodeHint: {
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  actionFeedback: {
    marginTop: -4,
    textAlign: 'center',
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    paddingHorizontal: 24,
  },
  actionError: {
    fontFamily: 'DMSans_600SemiBold',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryPillButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  myCodeButton: {
    borderRadius: 999,
    paddingHorizontal: 30,
    paddingVertical: 14,
  },
  myCodeText: { fontFamily: 'DMSans_400Regular', fontSize: 17, fontWeight: '700' },
});
