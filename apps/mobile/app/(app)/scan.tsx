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
            className='mt-2 items-center rounded-full bg-foreground py-3.5'
          >
            <Text className='font-sans text-[17px] font-bold text-background'>Retry</Text>
          </Pressable>
          <Pressable
            onPress={openScanner}
            className='items-center py-2'
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
            className='items-center py-2'
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
            className='mt-2 items-center rounded-full bg-foreground py-3.5'
          >
            <Text className='font-sans text-[17px] font-bold text-background'>Back to scan</Text>
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
    return <View className='flex-1 bg-background' />;
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
          className='mt-2 items-center rounded-full bg-foreground py-3.5'
        >
          <Text className='font-sans text-[17px] font-bold text-background'>Allow camera</Text>
        </Pressable>
        <Pressable
          onPress={openPayloadEntry}
          className='items-center py-2'
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Enter payload instead</Text>
        </Pressable>
        {user?.id ? (
          <Pressable
            onPress={openMyCode}
            className='items-center py-2'
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
      <View className='mt-[-8px] min-h-[620px] flex-1 gap-[18px] bg-background px-5 pb-3 pt-5'>
        <View className='items-center gap-1'>
          <Text className='font-sans text-[25px] font-bold text-foreground'>Scan to pay</Text>
          <Text className='font-sans text-[15px] text-muted-foreground'>
            Point at a Finora QR code
          </Text>
        </View>
        <View className='aspect-square max-h-[360px] w-full self-center overflow-hidden rounded-[26px] bg-[#151515]'>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing='back'
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={locked ? undefined : onBarcodeScanned}
          />
          <View
            className='absolute inset-12'
            pointerEvents='none'
          >
            <View className='absolute left-0 top-0 size-7 border-l-[3px] border-t-[3px] border-foreground' />
            <View className='absolute right-0 top-0 size-7 border-r-[3px] border-t-[3px] border-foreground' />
            <View className='absolute bottom-0 left-0 size-7 border-b-[3px] border-l-[3px] border-foreground' />
            <View className='absolute bottom-0 right-0 size-7 border-b-[3px] border-r-[3px] border-foreground' />
          </View>
        </View>
        {error ? (
          <Text className='font-sans text-sm leading-[18px] text-destructive'>{error}</Text>
        ) : null}
        <View className='min-h-16 flex-row items-center'>
          <View className='flex-1 items-start'>
            <Pressable
              accessibilityLabel='Choose QR from photo library'
              onPress={() => void scanFromLibrary()}
              className='size-[52px] items-center justify-center rounded-full bg-muted'
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
            className='rounded-full bg-foreground px-7 py-3.5'
          >
            <Text className='font-sans text-[17px] font-bold text-background'>Enter payload</Text>
          </Pressable>
          <View className='flex-1 items-end'>
            {user?.id ? (
              <Pressable
                accessibilityLabel='Show my receive QR code'
                onPress={openMyCode}
                className='size-[52px] items-center justify-center rounded-full bg-muted'
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
        <View className='flex-1 bg-background'>{content}</View>
      </SwipeBackView>
    );
  }

  return (
    <SwipeBackView>
      <View className='flex-1 bg-background'>
        <KeyboardAvoidingView
          className='flex-1'
          behavior={
            Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
          }
          keyboardVerticalOffset={headerHeight}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              gap: 12,
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 24,
            }}
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
      <View className='flex-row flex-wrap gap-2'>
        {CURRENCIES.map((c) => (
          <WizardChip
            key={c}
            label={c}
            selected={currency === c}
            onPress={() => setCurrency(c)}
          />
        ))}
      </View>
      <View className='flex-row flex-wrap gap-2'>
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
        className='rounded-[18px] border border-border bg-composer px-3 py-2.5 font-sans text-[17px] text-foreground'
      />
      <Pressable
        onPress={onContinue}
        disabled={amount == null || amount <= 0}
        className='mt-2 items-center rounded-full bg-foreground py-3.5'
        style={{ opacity: amount == null || amount <= 0 ? 0.4 : 1 }}
      >
        <Text className='font-sans text-[17px] font-bold text-background'>Continue to confirm</Text>
      </Pressable>
      <Pressable
        onPress={onBack}
        className='items-center py-2'
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
      <View
        className='self-center rounded-[26px] p-3.5'
        style={{ backgroundColor: isDark ? '#fff' : colors.background }}
      >
        <MockQrCode
          ref={qrRef}
          value={method.qrPayload}
          size={230}
          color='#18181b'
          backgroundColor='#ffffff'
        />
      </View>
      <Text className='text-center font-sans text-sm text-muted-foreground'>
        Save or scan this code to receive GHS.
      </Text>
      {actionState.error ? (
        <Text className='-mt-1 px-6 text-center font-sans-semibold text-[13px] text-destructive'>
          {actionState.error}
        </Text>
      ) : actionState.status ? (
        <Text className='-mt-1 px-6 text-center font-sans-medium text-[13px] text-muted-foreground'>
          {actionState.status}
        </Text>
      ) : null}
      <Pressable
        onPress={() => void shareCode()}
        disabled={actionState.busy}
        className='mt-2 items-center rounded-full bg-foreground py-3.5'
      >
        <Text className='font-sans text-[17px] font-bold text-background'>
          {actionState.busy ? 'Working…' : 'Share code'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => void saveCode()}
        disabled={actionState.busy}
        className='flex-row items-center justify-center rounded-full border border-border py-3'
      >
        <Text className='font-sans-semibold text-base text-foreground'>Save image</Text>
      </Pressable>
      <Pressable
        onPress={onBack}
        className='items-center py-2'
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
      contentContainerStyle={{
        flexGrow: 1,
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
      }}
      contentInsetAdjustmentBehavior='automatic'
      keyboardShouldPersistTaps='handled'
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.background }}
    >
      <View className='min-h-[180px] flex-1 items-center justify-center gap-2 pt-6'>
        <View className='size-[52px] items-center justify-center rounded-[18px] bg-muted'>
          <Icon
            name='clipboard'
            size={24}
            color={colors.foreground}
          />
        </View>
        <Text className='font-sans text-2xl font-bold text-foreground'>Enter payload</Text>
        <Text className='px-2 text-center font-sans text-[15px] leading-5 text-muted-foreground'>
          Paste the code or payload from a Finora receive QR or payment request.
        </Text>
      </View>
      <View className='relative justify-center'>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          onSubmitEditing={onSubmit}
          autoCapitalize='none'
          autoCorrect={false}
          returnKeyType='go'
          placeholder='finora:momo:ghs:0550123456'
          placeholderTextColor={colors.mutedForeground}
          className='rounded-[18px] border border-border bg-composer py-3.5 pl-3.5 pr-[52px] font-sans text-[17px] text-foreground'
        />
        <Pressable
          accessibilityLabel='Paste from clipboard'
          hitSlop={8}
          onPress={() => void pasteFromClipboard()}
          className='absolute right-1.5 size-9 items-center justify-center rounded-[14px] bg-muted'
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <Icon
            name='clipboard'
            size={19}
            color={colors.foreground}
          />
        </Pressable>
      </View>
      {error ? (
        <Text className='font-sans text-sm leading-[18px] text-destructive'>{error}</Text>
      ) : null}
      <Pressable
        onPress={() => {
          haptics.selection();
          onSubmit();
        }}
        disabled={!paste.trim()}
        className='mt-2 items-center rounded-full bg-foreground py-3.5'
        style={{ opacity: paste.trim() ? 1 : 0.4 }}
      >
        <Text className='font-sans text-[17px] font-bold text-background'>Use payload</Text>
      </Pressable>
      {onScanQr ? (
        <Pressable
          onPress={() => {
            haptics.selection();
            onScanQr();
          }}
          className='items-center py-2'
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Scan QR</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
