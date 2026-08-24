import { useAui, useAuiState, AuiIf, ComposerPrimitive } from '@assistant-ui/react-native';
import { useAuth } from '@clerk/expo';
import { ThinkingOrb } from '@mhaadi/thinking-orbs-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
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
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  type TextInputProps,
} from 'react-native';

import { AVATAR_COLORS } from '@/components/contacts/types';
import { Icon } from '@/components/ui/icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius, Rounded, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FINORA_TAG_GLOBAL_MIN_CHARS,
  searchFinoraTags,
  type FinoraTagSuggestion,
} from '@/lib/finora-tags';
import { haptics } from '@/lib/haptics';
import { payrollAttachmentContext, uploadPayrollAttachment } from '@/lib/payroll-attachments-api';
import { ensureMediaLibraryPermission } from '@/lib/permissions';
import { deleteRecording, transcribeRecording } from '@/lib/transcription-api';

import {
  ComposerImageAttachment,
  ComposerDocumentAttachment,
  ComposerAttachmentChip,
} from './attachment';

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
      style={({ pressed }) => [
        styles.actionButton,
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
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: pressed ? colors.muted : 'transparent' },
      ]}
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
const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

function useVoiceComposer() {
  const { getToken } = useAuth();
  const aui = useAui();
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [speechActive, setSpeechActive] = useState(false);
  const voiceStateRef = useRef<VoiceState>('idle');
  const speechActiveRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const draftBeforeRecordingRef = useRef('');
  const voiceSessionRef = useRef(0);
  const speechDetectedRef = useRef(false);
  const voiceActivitySamplesRef = useRef(0);
  const lastVoiceActivityAtRef = useRef(0);

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

  const updateSpeechActive = (next: boolean) => {
    if (speechActiveRef.current === next) return;
    speechActiveRef.current = next;
    if (mountedRef.current) setSpeechActive(next);
  };

  const stopRecording = async (discard = false) => {
    if (voiceStateRef.current !== 'recording') return;
    const sessionId = voiceSessionRef.current;
    updateSpeechActive(false);
    updateVoiceState(discard ? 'idle' : 'transcribing');
    clearStopTimer();

    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);

      if (!uri || discard) {
        deleteRecording(uri);
        return;
      }

      const contentType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && voiceStateRef.current === 'recording') {
        void stopRecording(true);
      }
    });

    return () => subscription.remove();
  });

  useEffect(() => {
    if (voiceState !== 'recording' || typeof recorderState.metering !== 'number') return;

    const now = Date.now();
    if (recorderState.metering >= VOICE_ACTIVITY_THRESHOLD_DB) {
      voiceActivitySamplesRef.current += 1;
      lastVoiceActivityAtRef.current = now;
      if (voiceActivitySamplesRef.current >= VOICE_ACTIVITY_SAMPLES_REQUIRED) {
        speechDetectedRef.current = true;
        updateSpeechActive(true);
      }
      return;
    }

    voiceActivitySamplesRef.current = 0;
    updateSpeechActive(false);
    if (!speechDetectedRef.current) {
      if (recorderState.durationMillis >= INITIAL_SILENCE_TIMEOUT_MS) {
        void stopRecording(true);
      }
      return;
    }

    if (now - lastVoiceActivityAtRef.current >= TRAILING_SILENCE_TIMEOUT_MS) {
      void stopRecording(false);
    }
  }, [recorderState.durationMillis, recorderState.metering, voiceState]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearStopTimer();
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
    updateSpeechActive(false);
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

  const handleOrbPress = () => {
    if (voiceStateRef.current === 'recording') {
      haptics.light();
      void stopRecording(false);
      return;
    }
    if (voiceStateRef.current === 'requesting_permission') {
      haptics.selection();
      voiceSessionRef.current += 1;
      updateVoiceState('idle');
      return;
    }
    if (voiceStateRef.current === 'transcribing') {
      haptics.selection();
      voiceSessionRef.current += 1;
      updateVoiceState('idle');
    }
  };

  return { voiceState, speechActive, startRecording, handleOrbPress };
}

function MicButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel='Dictate message'
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: pressed ? colors.muted : 'transparent' },
      ]}
    >
      <Icon
        name='mic'
        size={20}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

function PrimaryComposerAction({ onStartVoice }: { onStartVoice: () => void }) {
  const canSend = useAuiState((s) => s.thread.composer.canSend);
  return canSend ? <SendButton /> : <MicButton onPress={onStartVoice} />;
}

function VoiceComposer({
  state,
  speechActive,
  onPress,
}: {
  state: VoiceState;
  speechActive: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const label =
    state === 'recording'
      ? 'Listening. Tap to stop and transcribe.'
      : state === 'transcribing'
        ? 'Transcribing. Tap to cancel.'
        : 'Starting voice input. Tap to cancel.';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole='button'
      onPress={onPress}
      style={({ pressed }) => [
        styles.voiceShell,
        {
          backgroundColor: colors.composer,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View pointerEvents='none'>
        <ThinkingOrb
          state={
            state === 'recording'
              ? 'listening'
              : state === 'transcribing'
                ? 'solving'
                : 'connecting'
          }
          size={64}
          speed={state === 'requesting_permission' ? 1.2 : 1.5}
          paused={state === 'recording' && !speechActive}
          theme={isDark ? 'dark' : 'light'}
          accessibilityLabel={label}
        />
      </View>
    </Pressable>
  );
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
};

const ComposerInput = forwardRef<ComposerInputHandle, TextInputProps>(
  function ComposerInput(props, ref) {
    const { colors, isDark } = useTheme();
    const aui = useAui();
    const storeText = useAuiState((s) => s.thread.composer.text);
    const [localText, setLocalText] = useState(storeText);
    const nativeTextRef = useRef(storeText);
    const initialTextRef = useRef(storeText);
    const [tagProfiles, setTagProfiles] = useState<FinoraTagSuggestion[]>([]);
    const [directoryLoaded, setDirectoryLoaded] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const tagColor = isDark ? TAG_ACCENT.dark : TAG_ACCENT.light;

    useImperativeHandle(ref, () => ({ blur: () => inputRef.current?.blur() }), []);

    useEffect(() => {
      if (nativeTextRef.current === storeText) return;
      nativeTextRef.current = storeText;
      setLocalText(storeText);
      if (storeText) inputRef.current?.setNativeProps({ text: storeText });
      else inputRef.current?.clear();
    }, [storeText]);

    const mentionMatch = localText.match(/(?:^|\s)@([a-z0-9_]*)$/i);
    const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? null;

    useEffect(() => {
      if (mentionQuery === null) {
        setDirectoryLoaded(false);
        setTagProfiles([]);
        return;
      }
      let active = true;
      void searchFinoraTags(mentionQuery).then((next) => {
        if (!active) return;
        setTagProfiles(next);
        setDirectoryLoaded(true);
      });
      return () => {
        active = false;
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

    const emptyHint =
      mentionQuery !== null && mentionQuery.length < FINORA_TAG_GLOBAL_MIN_CHARS
        ? 'Recent Finora recipients only. Type the full tag or 3+ characters.'
        : 'No recent match. Type the exact Finora Tag to send.';

    return (
      <View style={styles.inputWrap}>
        {mentionQuery !== null && directoryLoaded && (
          <View
            style={[
              styles.mentionMenu,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.mentionEyebrow, { color: colors.mutedForeground }]}>
              Recent Finora Tags
            </Text>
            {tagProfiles.length ? (
              tagProfiles.map((profile, index) => (
                <Pressable
                  key={profile.accountId}
                  accessibilityLabel={`Send to ${profile.displayName}, @${profile.tag}`}
                  onPress={() => selectTag(profile)}
                  style={({ pressed }) => [
                    styles.mentionRow,
                    pressed && { backgroundColor: colors.muted },
                  ]}
                >
                  <View
                    style={[
                      styles.mentionAvatar,
                      { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
                    ]}
                  >
                    <Text style={styles.mentionInitials}>{profile.initials}</Text>
                  </View>
                  <View style={styles.mentionMeta}>
                    <Text
                      numberOfLines={1}
                      style={[styles.mentionName, { color: colors.foreground }]}
                    >
                      {profile.displayName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.mentionHandle, { color: colors.mutedForeground }]}
                    >
                      @{profile.tag} ·{' '}
                      {profile.source === 'exact' ? 'Exact match' : 'Finora wallet'}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.mentionEmpty, { color: colors.mutedForeground }]}>
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
  const { colors } = useTheme();
  const inputRef = useRef<ComposerInputHandle>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const { voiceState, speechActive, startRecording, handleOrbPress } = useVoiceComposer();
  const hasAttachments = useAuiState((s) => s.thread.composer.attachments.length > 0);
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

  return (
    <View style={styles.container}>
      {voiceState !== 'idle' ? (
        <VoiceComposer
          state={voiceState}
          speechActive={speechActive}
          onPress={handleOrbPress}
        />
      ) : (
        <View
          style={[styles.shell, { backgroundColor: colors.composer, borderColor: colors.border }]}
        >
          {hasAttachments ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.attachmentsScroller}
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

          <View style={styles.actionRow}>
            <AttachButton />
            <ScanButton />
            <View style={styles.spacer} />
            {inputFocused ? (
              <Pressable
                accessibilityLabel='Hide keyboard'
                hitSlop={8}
                onPress={() => {
                  inputRef.current?.blur();
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => [
                  styles.doneButton,
                  { backgroundColor: pressed ? colors.muted : 'transparent' },
                ]}
              >
                <Text style={[styles.doneButtonText, { color: colors.foreground }]}>Done</Text>
              </Pressable>
            ) : null}
            <AuiIf condition={(s) => !s.thread.isRunning}>
              <PrimaryComposerAction
                onStartVoice={() => {
                  inputRef.current?.blur();
                  Keyboard.dismiss();
                  void startRecording();
                }}
              />
            </AuiIf>
            <AuiIf condition={(s) => s.thread.isRunning}>
              <CancelButton />
            </AuiIf>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: Spacing.threadMaxWidth + 24,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  shell: {
    ...Rounded,
    flexDirection: 'column',
    gap: 10,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },

  input: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 22,
    minHeight: 28,
    maxHeight: 132,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    ...Platform.select({
      web: { outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  inputWrap: {
    width: '100%',
  },
  mentionMenu: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    marginBottom: 8,
    padding: 6,
  },
  mentionEyebrow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  mentionRow: {
    minHeight: 50,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  mentionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionInitials: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    fontWeight: '700',
  },
  mentionMeta: {
    flex: 1,
    gap: 1,
  },
  mentionName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  mentionHandle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
  },
  mentionEmpty: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  attachmentsScroller: {
    maxHeight: 84,
    flexGrow: 0,
  },
  attachmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  spacer: {
    flex: 1,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    minWidth: 48,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  doneButtonText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    fontWeight: '600',
  },
  voiceShell: {
    ...Rounded,
    width: '38%',
    minWidth: 104,
    maxWidth: 144,
    height: 80,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    padding: 8,
  },
});
