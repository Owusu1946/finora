import { useAui, useAuiState, AuiIf, ComposerPrimitive } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  View,
  AppState,
  Platform,
  ActionSheetIOS,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AVATAR_COLORS } from '@/components/contacts/types';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius, Rounded, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FINORA_TAG_GLOBAL_MIN_CHARS,
  searchFinoraTagsRemote,
  type FinoraTagSuggestion,
} from '@/lib/finora-tags';
import { haptics } from '@/lib/haptics';
import { startLiveTranscription, type LiveTranscriptionSession } from '@/lib/live-transcription';
import { payrollAttachmentContext, uploadPayrollAttachment } from '@/lib/payroll-attachments-api';
import { ensureMediaLibraryPermission } from '@/lib/permissions';
import { deleteRecording, transcribeRecording } from '@/lib/transcription-api';

import {
  ComposerImageAttachment,
  ComposerDocumentAttachment,
  ComposerAttachmentChip,
} from './attachment';
import { VoiceScreenBloom, type VoiceBloomPalette } from './VoiceScreenBloom';

const COMPOSER_ATTACHMENT_COMPONENTS = {
  Image: ComposerImageAttachment,
  Document: ComposerDocumentAttachment,
  File: ComposerDocumentAttachment,
  Attachment: ComposerAttachmentChip,
};

const TAG_ACCENT = {
  light: '#0F766E',
  dark: '#2DD4BF',
} as const;

function AttachButton() {
  const { colors } = useTheme();
  const aui = useAui();
  const { getToken } = useAuth();

  const addUploadedAttachment = async (source: Parameters<typeof uploadPayrollAttachment>[0]) => {
    try {
      const uploaded = await uploadPayrollAttachment(source, getToken);
      await aui.composer.addAttachment({
        id: uploaded.attachmentId,
        name: uploaded.name,
        type: uploaded.contentType.startsWith('image/') ? 'image' : 'document',
        contentType: uploaded.contentType,
        content: [{ type: 'text', text: payrollAttachmentContext(uploaded) }],
      });
      haptics.success();
    } catch (error) {
      Alert.alert(
        'Could not attach file',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const openWebFilePicker = (acceptTypes: string) => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptTypes;
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      for (const file of files) {
        await addUploadedAttachment({
          file,
          name: file.name,
          contentType: file.type || 'application/octet-stream',
        });
      }
    };
    input.click();
  };

  const handleNativePickImage = async () => {
    const hasPermission = await ensureMediaLibraryPermission(
      'Allow photo access in Settings to attach images.',
    );
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (result.canceled || !result.assets?.length) return;

    for (const asset of result.assets) {
      await addUploadedAttachment({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        contentType: asset.mimeType || 'image/jpeg',
        size: asset.fileSize,
      });
    }
  };

  const handleNativePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
    });

    if (result.canceled || !result.assets?.length) return;

    for (const asset of result.assets) {
      await addUploadedAttachment({
        uri: asset.uri,
        name: asset.name,
        contentType: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      });
    }
  };

  const handlePress = () => {
    haptics.selection();
    // Settle keyboard layout before the system picker takes over.
    Keyboard.dismiss();

    if (Platform.OS === 'web' || typeof document !== 'undefined') {
      openWebFilePicker('image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.csv,.json');
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Choose Document'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) void handleNativePickImage();
          else if (buttonIndex === 2) void handleNativePickDocument();
        },
      );
      return;
    }

    Alert.alert('Add Attachment', 'Choose attachment type', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Photo', onPress: () => void handleNativePickImage() },
      { text: 'Document', onPress: () => void handleNativePickDocument() },
    ]);
  };

  return (
    <Pressable
      accessibilityLabel='Attach file or photo'
      hitSlop={8}
      onPress={handlePress}
      className='h-[38px] w-[38px] items-center justify-center'
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? colors.muted : 'transparent',
        },
      ]}
    >
      <Icon
        name='attach'
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

function ScanButton() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel='Scan QR to pay'
      hitSlop={8}
      onPress={() => {
        haptics.selection();
        router.push('/scan');
      }}
      className='h-[38px] w-[38px] items-center justify-center'
      style={({ pressed }) => [{ backgroundColor: pressed ? colors.muted : 'transparent' }]}
    >
      <Icon
        name='qr'
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

type VoiceState = 'idle' | 'requesting_permission' | 'recording' | 'transcribing';

const MAX_RECORDING_SECONDS = 45;
const INITIAL_SILENCE_TIMEOUT_MS = 7_000;
const TRAILING_SILENCE_TIMEOUT_MS = 2_500;
const VOICE_ACTIVITY_THRESHOLD_DB = -42;
const VOICE_ACTIVITY_SAMPLES_REQUIRED = 2;
const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  // ADTS AAC on both platforms: raw frames can be tailed out of the file and
  // streamed to the live transcription WebSocket while the recorder runs.
  extension: '.aac',
  numberOfChannels: 1,
  android: { ...RecordingPresets.HIGH_QUALITY.android, outputFormat: 'aac_adts' },
};

// expo-audio metering is dB (about -160..0). Speech sits between -42 and -8,
// so a -50..-6 window maps a full quiet-to-loud swing onto 0..1.
const METERING_FLOOR_DB = -50;
const METERING_RANGE_DB = 44;

// Lobes are the reference aurora palette (green, sky, violet, rose) — vivid
// on both themes. The core is the hot line at the bottom edge: near-white
// teal on dark to read as the bright centre; a soft tint on light where a
// strong core would smear into a dark band.
const VOICE_BLOOM_LIGHT: VoiceBloomPalette = {
  core: '#CCFBF1',
  lobes: ['#22C55E', '#38BDF8', '#A855F7', '#F43F5E'],
};
const VOICE_BLOOM_DARK: VoiceBloomPalette = {
  core: '#D8FFF6',
  lobes: ['#22C55E', '#38BDF8', '#A855F7', '#F43F5E'],
};

function useVoiceComposer() {
  const { getToken } = useAuth();
  const aui = useAui();
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const voiceStateRef = useRef<VoiceState>('idle');
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const draftBeforeRecordingRef = useRef('');
  const voiceSessionRef = useRef(0);
  const speechDetectedRef = useRef(false);
  const voiceActivitySamplesRef = useRef(0);
  const lastVoiceActivityAtRef = useRef(0);
  const stopRecordingRef = useRef<(discard?: boolean) => Promise<void>>(() => Promise.resolve());
  const liveSessionRef = useRef<LiveTranscriptionSession | null>(null);
  const liveFinalsRef = useRef('');
  const [preview, setPreview] = useState('');

  // Smoothed 0–1 mic level for the glow, animated on the UI thread.
  const level = useSharedValue(0);
  useEffect(() => {
    const metering = recorderState.metering;
    if (voiceState !== 'recording' || typeof metering !== 'number') {
      level.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) });
      return;
    }
    const normalized = Math.min(1, Math.max(0, (metering - METERING_FLOOR_DB) / METERING_RANGE_DB));
    level.value = withTiming(normalized, { duration: 170, easing: Easing.out(Easing.quad) });
  }, [level, recorderState.durationMillis, recorderState.metering, voiceState]);

  voiceStateRef.current = voiceState;

  const clearStopTimer = () => {
    if (!stopTimerRef.current) return;
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  };

  const updateVoiceState = (next: VoiceState) => {
    voiceStateRef.current = next;
    if (mountedRef.current) setVoiceState(next);
  };

  // Live previews append committed phrases and swap the interim partial:
  // "finals + current partial" is what the user reads while speaking.
  const resetLivePreview = () => {
    liveFinalsRef.current = '';
    setPreview('');
  };
  const setLivePartial = (text: string) => {
    const finals = liveFinalsRef.current;
    setPreview(finals ? `${finals} ${text}` : text);
  };

  const stopRecording = async (discard = false) => {
    if (voiceStateRef.current !== 'recording') return;
    const sessionId = voiceSessionRef.current;
    updateVoiceState(discard ? 'idle' : 'transcribing');
    clearStopTimer();

    const live = liveSessionRef.current;
    liveSessionRef.current = null;
    if (live) {
      // Flush the tail before closing so the preview sees everything spoken
      // right up to the press; cancel discards unstreamed bytes.
      await live.stop(!discard);
    }

    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

      if (!uri || discard) {
        deleteRecording(uri);
        return;
      }

      const contentType = Platform.OS === 'web' ? 'audio/webm' : 'audio/aac';
      const result = await transcribeRecording(uri, contentType, getToken);
      if (!mountedRef.current || voiceSessionRef.current !== sessionId) return;

      const transcript = result.transcript.trim();
      if (!transcript) return;
      const existing = draftBeforeRecordingRef.current.trimEnd();
      aui.thread.composer().setText(existing ? `${existing} ${transcript}` : transcript);
      haptics.success();
    } catch (error) {
      if (!discard && mountedRef.current && voiceSessionRef.current === sessionId) {
        haptics.error();
        Alert.alert(
          'Could not transcribe',
          error instanceof Error ? error.message : 'Please try recording again.',
        );
      }
    } finally {
      if (voiceSessionRef.current === sessionId) updateVoiceState('idle');
    }
  };
  stopRecordingRef.current = stopRecording;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && voiceStateRef.current === 'recording') {
        void stopRecordingRef.current(true);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (voiceState !== 'recording' || typeof recorderState.metering !== 'number') return;

    const now = Date.now();
    if (recorderState.metering >= VOICE_ACTIVITY_THRESHOLD_DB) {
      voiceActivitySamplesRef.current += 1;
      lastVoiceActivityAtRef.current = now;
      if (voiceActivitySamplesRef.current >= VOICE_ACTIVITY_SAMPLES_REQUIRED) {
        speechDetectedRef.current = true;
      }
      return;
    }

    voiceActivitySamplesRef.current = 0;
    if (!speechDetectedRef.current) {
      if (recorderState.durationMillis >= INITIAL_SILENCE_TIMEOUT_MS) {
        void stopRecordingRef.current(true);
      }
      return;
    }

    if (now - lastVoiceActivityAtRef.current >= TRAILING_SILENCE_TIMEOUT_MS) {
      void stopRecordingRef.current(false);
    }
  }, [recorderState.durationMillis, recorderState.metering, voiceState]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearStopTimer();
      void liveSessionRef.current?.stop(false);
      if (voiceStateRef.current === 'recording') {
        void recorder.stop().then(() => deleteRecording(recorder.uri));
      }
    };
  }, [recorder]);

  const startRecording = async () => {
    if (voiceStateRef.current !== 'idle') return;
    const sessionId = voiceSessionRef.current + 1;
    voiceSessionRef.current = sessionId;
    draftBeforeRecordingRef.current = aui.thread.composer().getState().text;
    speechDetectedRef.current = false;
    voiceActivitySamplesRef.current = 0;
    lastVoiceActivityAtRef.current = 0;
    updateVoiceState('requesting_permission');
    haptics.selection();

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone access needed',
          'Allow microphone access in Settings to dictate messages to Finora.',
        );
        return;
      }
      if (voiceSessionRef.current !== sessionId) return;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (voiceSessionRef.current !== sessionId) {
        if (voiceStateRef.current === 'idle') {
          await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
        }
        return;
      }
      recorder.record();
      updateVoiceState('recording');
      haptics.light();
      stopTimerRef.current = setTimeout(
        () => void stopRecording(false),
        MAX_RECORDING_SECONDS * 1000,
      );

      // Stream the growing recording into the live transcript feed for the
      // on-device preview. Failures here degrade to no preview only; the
      // one-shot transcription after stop stays authoritative.
      resetLivePreview();
      const liveUri = recorder.uri;
      if (liveUri) {
        void startLiveTranscription(liveUri, getToken, {
          onTranscript: (text, isFinal) => {
            if (voiceSessionRef.current !== sessionId) return;
            if (isFinal) liveFinalsRef.current = `${liveFinalsRef.current} ${text}`.trim();
            setLivePartial(isFinal ? '' : text);
          },
          onError: (error) => {
            console.warn('[voice:live]', error);
          },
        })
          .then((session) => {
            if (voiceSessionRef.current !== sessionId) void session.stop(false);
            else liveSessionRef.current = session;
          })
          .catch((error) => {
            console.warn('[voice:live]', error);
          });
      }
    } catch (error) {
      if (voiceSessionRef.current === sessionId || voiceStateRef.current === 'idle') {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
      if (voiceSessionRef.current === sessionId) {
        Alert.alert(
          'Could not start recording',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    } finally {
      if (
        voiceSessionRef.current === sessionId &&
        (voiceStateRef.current as VoiceState) === 'requesting_permission'
      ) {
        updateVoiceState('idle');
      }
    }
  };

  const cancelVoice = () => {
    haptics.selection();
    // Voice never touches the composer text until a transcript lands, so
    // restoring the pre-recording draft is "bring back composer empty" for
    // the everyday case and keeps an existing draft safe.
    aui.thread.composer().setText(draftBeforeRecordingRef.current);
    resetLivePreview();
    if (voiceStateRef.current === 'recording') {
      void stopRecording(true);
    } else {
      voiceSessionRef.current += 1;
      const live = liveSessionRef.current;
      liveSessionRef.current = null;
      void live?.stop(false);
      updateVoiceState('idle');
    }
  };

  const acceptVoice = () => {
    if (voiceStateRef.current !== 'recording') return;
    haptics.light();
    void stopRecording(false);
  };

  return { voiceState, level, preview, startRecording, cancelVoice, acceptVoice };
}

function MicButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel='Dictate message'
      hitSlop={8}
      onPress={onPress}
      className='h-[38px] w-[38px] items-center justify-center'
      style={({ pressed }) => [{ backgroundColor: pressed ? colors.muted : 'transparent' }]}
    >
      <Icon
        name='mic'
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

function PrimaryComposerAction({ onPressMic }: { onPressMic: () => void }) {
  const canSend = useAuiState((s) => s.thread.composer.canSend);
  return canSend ? <SendButton /> : <MicButton onPress={onPressMic} />;
}

function SendButton() {
  const { colors } = useTheme();
  const runtimeCanSend = useAuiState((s) => s.thread.composer.canSend);
  const canSend = runtimeCanSend;

  return (
    <ComposerPrimitive.Send
      accessibilityLabel='Send message'
      disabled={!canSend}
      onPressIn={() => {
        if (!canSend) return;
        haptics.success();
        Keyboard.dismiss();
      }}
      style={[styles.actionButton, { backgroundColor: canSend ? colors.primary : colors.muted }]}
    >
      <Icon
        name='send'
        size={18}
        color={canSend ? colors.primaryForeground : colors.mutedForeground}
      />
    </ComposerPrimitive.Send>
  );
}

function CancelButton() {
  const { colors } = useTheme();
  return (
    <ComposerPrimitive.Cancel
      accessibilityLabel='Stop generating'
      onPressIn={haptics.light}
      style={[styles.actionButton, { backgroundColor: colors.foreground }]}
    >
      <Icon
        name='stop'
        size={15}
        color={colors.background}
      />
    </ComposerPrimitive.Cancel>
  );
}

/**
 * Keep the native text field authoritative while typing. The assistant store
 * still receives every edit, but never controls the native value prop, which
 * avoids selection reconciliation and caret jumps during deletes.
 */
type ComposerInputHandle = {
  blur: () => void;
  focus: () => void;
};

const ComposerInput = forwardRef<ComposerInputHandle, TextInputProps>(
  function ComposerInput(props, ref) {
    const { colors, isDark } = useTheme();
    const aui = useAui();
    const { getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const storeText = useAuiState((s) => s.thread.composer.text);
    const [localText, setLocalText] = useState(storeText);
    const nativeTextRef = useRef(storeText);
    const initialTextRef = useRef(storeText);
    const [tagProfiles, setTagProfiles] = useState<FinoraTagSuggestion[]>([]);
    const [directoryLoaded, setDirectoryLoaded] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const tagColor = isDark ? TAG_ACCENT.dark : TAG_ACCENT.light;

    useImperativeHandle(
      ref,
      () => ({
        blur: () => inputRef.current?.blur(),
        focus: () => inputRef.current?.focus(),
      }),
      [],
    );

    useEffect(() => {
      if (nativeTextRef.current === storeText) return;
      nativeTextRef.current = storeText;
      setLocalText(storeText);
      if (storeText) inputRef.current?.setNativeProps({ text: storeText });
      else inputRef.current?.clear();
    }, [storeText]);

    const mentionMatch = localText.match(/(?:^|\s)@([a-z0-9_]*)$/i);
    const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? null;
    const slashQuery = localText.match(/^\/([a-z]*)$/i)?.[1]?.toLowerCase() ?? null;
    const slashCommands = [
      {
        command: '/web',
        title: 'Web search',
        description: 'Fast current information with sources',
        icon: 'tool' as const,
      },
      {
        command: '/shop',
        title: 'Product search',
        description: 'Find current listings within a budget',
        icon: 'dollar' as const,
      },
      {
        command: '/deep',
        title: 'Deep research',
        description: 'Thorough multi-source investigation',
        icon: 'brain' as const,
      },
    ].filter((item) => !slashQuery || item.command.slice(1).startsWith(slashQuery));

    useEffect(() => {
      if (mentionQuery === null) {
        setDirectoryLoaded((prev) => (prev ? false : prev));
        setTagProfiles((current) => (current.length ? [] : current));
        return;
      }
      let active = true;
      const controller = new AbortController();
      const timer = setTimeout(() => {
        void searchFinoraTagsRemote(mentionQuery, getTokenRef.current, controller.signal)
          .then((next) => {
            if (!active) return;
            setTagProfiles(next);
            setDirectoryLoaded(true);
          })
          .catch((error: unknown) => {
            if (!active || (error instanceof Error && error.name === 'AbortError')) return;
            setTagProfiles([]);
            setDirectoryLoaded(true);
          });
      }, 120);
      return () => {
        active = false;
        clearTimeout(timer);
        controller.abort();
      };
    }, [mentionQuery]);

    const selectTag = (profile: FinoraTagSuggestion) => {
      if (!mentionMatch || mentionQuery === null) return;
      const mentionStart = (mentionMatch.index ?? 0) + mentionMatch[0].lastIndexOf('@');
      const next = `${localText.slice(0, mentionStart)}@${profile.tag} `;
      nativeTextRef.current = next;
      setLocalText(next);
      inputRef.current?.setNativeProps({ text: next });
      aui.thread.composer().setText(next);
      haptics.selection();
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    const selectSlashCommand = (command: string) => {
      const next = `${command} `;
      nativeTextRef.current = next;
      setLocalText(next);
      inputRef.current?.setNativeProps({ text: next });
      aui.thread.composer().setText(next);
      haptics.selection();
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    const emptyHint =
      mentionQuery !== null && mentionQuery.length < FINORA_TAG_GLOBAL_MIN_CHARS
        ? 'Recent Finora recipients only. Type the full tag or 3+ characters.'
        : 'No recent match. Type the exact Finora Tag to send.';

    return (
      <View className='w-full'>
        {slashQuery !== null ? (
          <View
            className='border mb-2 p-1.5 bg-background border-border'
            style={[styles.mentionMenu]}
          >
            <Text className='font-sans-semibold text-[11px] tracking-[0.7px] px-2 py-[5px] uppercase text-muted-foreground'>
              Search modes
            </Text>
            {slashCommands.map((item) => (
              <Pressable
                key={item.command}
                accessibilityLabel={`Select ${item.title}`}
                onPress={() => selectSlashCommand(item.command)}
                className='min-h-[54px] flex-row items-center gap-3 px-2 py-1.5'
                style={({ pressed }) => [pressed && { backgroundColor: colors.muted }]}
              >
                <View className='h-9 w-9 items-center justify-center rounded-full bg-muted'>
                  <Icon
                    name={item.icon}
                    size={17}
                    color={colors.foreground}
                  />
                </View>
                <View className='flex-1'>
                  <Text className='font-sans-semibold text-[14px] text-foreground'>
                    {item.title}
                  </Text>
                  <Text className='font-sans text-[12px] text-muted-foreground'>
                    {item.description}
                  </Text>
                </View>
                <Text className='font-sans-medium text-[12px] text-muted-foreground'>
                  {item.command}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {mentionQuery !== null && directoryLoaded && (
          <View
            className='border mb-2 p-1.5 bg-background border-border'
            style={[styles.mentionMenu]}
          >
            <Text className='font-sans-semibold text-[11px] tracking-[0.7px] px-2 py-[5px] uppercase text-muted-foreground'>
              Recent Finora Tags
            </Text>
            {tagProfiles.length ? (
              tagProfiles.map((profile, index) => (
                <Pressable
                  key={profile.accountId}
                  accessibilityLabel={`Send to ${profile.displayName}, @${profile.tag}`}
                  onPress={() => selectTag(profile)}
                  className='min-h-[50px] flex-row items-center gap-2.5 px-2 py-1.5'
                  style={({ pressed }) => [pressed && { backgroundColor: colors.muted }]}
                >
                  <View
                    className='w-[34px] h-[34px] rounded-[17px] items-center justify-center'
                    style={[{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}
                  >
                    <Text className='font-sans-semibold text-white text-[13px]'>
                      {profile.initials}
                    </Text>
                  </View>
                  <View className='flex-1 gap-px'>
                    <Text
                      numberOfLines={1}
                      className='font-sans-semibold text-[14px] text-foreground'
                    >
                      {profile.displayName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className='font-sans text-[12px] text-muted-foreground'
                    >
                      @{profile.tag} ·{' '}
                      {profile.source === 'exact' ? 'Exact match' : 'Finora wallet'}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text className='font-sans text-[13px] px-2 py-3 text-muted-foreground'>
                {emptyHint}
              </Text>
            )}
          </View>
        )}
        <TextInput
          {...props}
          ref={inputRef}
          defaultValue={initialTextRef.current}
          selectionColor={tagColor}
          onChangeText={(text) => {
            nativeTextRef.current = text;
            setLocalText(text);
            aui.thread.composer().setText(text);
          }}
        />
      </View>
    );
  },
);

export function Composer() {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<ComposerInputHandle>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const { voiceState, level, preview, startRecording, cancelVoice, acceptVoice } =
    useVoiceComposer();
  const insets = useSafeAreaInsets();
  const hasAttachments = useAuiState((s) => s.thread.composer.attachments.length > 0);
  const composerText = useAuiState((s) => s.thread.composer.text);
  const slashMode = /^(\/(?:web|search|shop|product|products|deep|research))?(?:\s|$)/i
    .exec(composerText)?.[1]
    ?.toLowerCase();
  const inputStyle = useMemo(
    () => [styles.input, { color: colors.foreground }],
    [colors.foreground],
  );

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      inputRef.current?.blur();
      setInputFocused(false);
    });
    return () => subscription.remove();
  }, []);

  const handleMicPress = () => {
    if (voiceState === 'idle') {
      inputRef.current?.blur();
      Keyboard.dismiss();
      void startRecording();
    } else if (voiceState === 'recording') {
      acceptVoice();
    } else {
      cancelVoice();
    }
  };

  return (
    <View
      className='w-full self-center px-3 pt-2'
      style={[styles.container]}
    >
      {voiceState !== 'idle' ? (
        <>
          {/* Glow renders first so the transcript and controls draw over it. */}
          <VoiceScreenBloom
            level={level}
            processing={voiceState === 'transcribing'}
            bottomBleed={insets.bottom + 14}
            colors={isDark ? VOICE_BLOOM_DARK : VOICE_BLOOM_LIGHT}
            additive={isDark}
          />
          <View className='h-[128px] w-full items-center justify-end'>
            <View className='min-h-[56px] w-full items-center justify-end pb-3'>
              {preview ? (
                <Text
                  numberOfLines={3}
                  className='text-center font-sans-medium text-[17px] text-foreground'
                >
                  {preview}
                </Text>
              ) : null}
            </View>
            <View className='mb-2 flex-row items-center justify-end gap-6'>
              <Pressable
                accessibilityLabel='Cancel voice input'
                accessibilityRole='button'
                onPress={cancelVoice}
                className='h-12 w-12 items-center justify-center rounded-full border border-border'
                style={({ pressed }) => [
                  { backgroundColor: colors.composer, opacity: pressed ? 0.6 : 0.95 },
                ]}
              >
                <Icon
                  name='remove'
                  size={20}
                  color={colors.foreground}
                />
              </Pressable>
              {voiceState === 'recording' ? (
                <Pressable
                  accessibilityLabel='Finish voice input'
                  accessibilityRole='button'
                  onPress={acceptVoice}
                  className='h-12 w-12 items-center justify-center rounded-full border border-border'
                  style={({ pressed }) => [
                    { backgroundColor: colors.composer, opacity: pressed ? 0.6 : 0.95 },
                  ]}
                >
                  <Icon
                    name='mic'
                    size={20}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
              {voiceState === 'transcribing' ? (
                <View
                  className='h-12 w-12 items-center justify-center rounded-full border border-border'
                  style={[{ backgroundColor: colors.composer, opacity: 0.95 }]}
                >
                  <LoadingIcon
                    color={colors.mutedForeground}
                    size={20}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </>
      ) : (
        <Pressable
          accessible={false}
          onPress={() => inputRef.current?.focus()}
          className='flex-col gap-2.5 rounded-[32px] border border-border bg-composer px-3 pb-2.5 pt-3'
          style={[styles.shell]}
        >
          {slashMode ? (
            <View className='flex-row items-center gap-2 px-2'>
              <View className='h-6 w-6 items-center justify-center rounded-full bg-muted'>
                <Icon
                  name={
                    slashMode.includes('deep') || slashMode.includes('research')
                      ? 'brain'
                      : slashMode.includes('shop') || slashMode.includes('product')
                        ? 'dollar'
                        : 'tool'
                  }
                  size={13}
                  color={colors.foreground}
                />
              </View>
              <Text className='font-sans-medium text-[12px] text-muted-foreground'>
                {slashMode.includes('deep') || slashMode.includes('research')
                  ? 'Deep research mode'
                  : slashMode.includes('shop') || slashMode.includes('product')
                    ? 'Product search mode'
                    : 'Web search mode'}
              </Text>
            </View>
          ) : null}
          {hasAttachments ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className='max-h-[84px] grow-0'
              contentContainerStyle={styles.attachmentsRow}
              keyboardShouldPersistTaps='handled'
            >
              <ComposerPrimitive.Attachments components={COMPOSER_ATTACHMENT_COMPONENTS} />
            </ScrollView>
          ) : null}

          <ComposerInput
            ref={inputRef}
            style={inputStyle}
            placeholder='Ask Finora… use @ to tag'
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={4000}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />

          <View className='flex-row items-center gap-1 pt-0.5'>
            <AttachButton />
            <ScanButton />
            <View className='flex-1' />
            {inputFocused ? (
              <Pressable
                accessibilityLabel='Hide keyboard'
                hitSlop={8}
                onPress={() => {
                  inputRef.current?.blur();
                  Keyboard.dismiss();
                }}
                className='h-[38px] min-w-12 items-center justify-center rounded-full px-2'
                style={({ pressed }) => [
                  { backgroundColor: pressed ? colors.muted : 'transparent' },
                ]}
              >
                <Text className='font-sans-semibold text-[14px] text-foreground'>Done</Text>
              </Pressable>
            ) : null}
            <AuiIf condition={(s) => !s.thread.isRunning}>
              <PrimaryComposerAction onPressMic={handleMicPress} />
            </AuiIf>
            <AuiIf condition={(s) => s.thread.isRunning}>
              <CancelButton />
            </AuiIf>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = {
  container: {
    maxWidth: Spacing.threadMaxWidth + 24,
  },
  shell: {
    ...Rounded,
    borderRadius: Radius.composer,
  },
  input: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 22,
    minHeight: 28,
    // Four lines of 22px + top/bottom padding.
    maxHeight: 96,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  mentionMenu: {
    borderRadius: Radius.lg,
  },
  mentionRow: {
    borderRadius: Radius.md,
  },
  attachmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  actionButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  doneButton: {
    borderRadius: Radius.pill,
  },
} as const;
