import { useAui } from '@assistant-ui/react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { SwipeBackView } from '@/components/navigation/swipe-back-view';
import { Icon } from '@/components/ui/icon';
import { AppText as Text, AppTextInput as TextInput } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { buildScanPayPrompt, parsePaymentQr, type ParsedPaymentQr } from '@/lib/payment-qr';
import { sendChatPrompt } from '@/lib/send-chat-prompt';

const AMOUNTS = [25, 50, 100, 250, 500];
const CURRENCIES = ['GHS', 'USD', 'GBP', 'EUR', 'USDT'];

type Phase = 'scan' | 'payload' | 'amount';

export default function ScanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const aui = useAui();
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

  const onContinueAmount = () => {
    if (!parsed || amount == null || amount <= 0) return;
    haptics.selection();
    finishPay(parsed, amount, currency);
  };

  let content: ReactNode;

  if (Platform.OS === 'web') {
    content = (
      <>
        <WizardStepHeader
          step={1}
          total={2}
          title='Enter payment payload'
          subtitle='Paste the payload from a Finora receive QR or payment request.'
        />
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
  } else if (phase === 'payload') {
    content = (
      <>
        <WizardStepHeader
          step={1}
          total={2}
          title='Enter payment payload'
          subtitle='Paste the payload from a Finora receive QR or payment request.'
        />
        <PasteBlock
          paste={paste}
          setPaste={setPaste}
          onSubmit={onPasteSubmit}
          error={error}
        />
        {permission?.granted ? (
          <Pressable
            onPress={openScanner}
            style={styles.linkBtn}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Back to camera</Text>
          </Pressable>
        ) : null}
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
      <>
        <WizardStepHeader
          step={1}
          total={2}
          title='Scan to pay'
          subtitle='Point at a Finora receive QR or payment-request code.'
        />
        <View style={[styles.cameraWrap, { borderColor: colors.border }]}>
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
        <Pressable
          onPress={openPayloadEntry}
          style={styles.payloadLink}
        >
          <Text style={[styles.payloadLinkText, { color: colors.foreground }]}>
            Or enter payload
          </Text>
          <Icon
            name='chevron-right'
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      </>
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

function PasteBlock({
  paste,
  setPaste,
  onSubmit,
  error,
}: {
  paste: string;
  setPaste: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
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
    <View style={styles.pasteBlock}>
      <Text style={[styles.pasteLabel, { color: colors.mutedForeground }]}>Payment payload</Text>
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
            styles.input,
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
        style={[styles.secondaryBtn, { borderColor: colors.border }]}
      >
        <Icon
          name='qr'
          size={16}
          color={colors.foreground}
        />
        <Text style={{ color: colors.foreground, fontWeight: '600', marginLeft: 8 }}>
          Use payload
        </Text>
      </Pressable>
    </View>
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
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignSelf: 'center',
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
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingVertical: 12,
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
  pasteBlock: {
    gap: 8,
    marginTop: 4,
  },
  payloadInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  payloadInput: {
    paddingRight: 52,
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
});
