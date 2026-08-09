import { useAui, useAuiState, AuiIf, ComposerPrimitive } from '@assistant-ui/react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Platform,
  ActionSheetIOS,
  Alert,
  Keyboard,
  StyleSheet,
  Pressable,
  TextInput,
  Text as RNText,
  type TextStyle,
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

const TAG_TOKEN_RE = /@[a-z][a-z0-9_]{0,23}/gi;
const TAG_ACCENT = {
  light: '#0F766E',
  dark: '#2DD4BF',
} as const;

/**
 * Overlay must use the same font metrics as TextInput.
 * Color-only tagging — never change weight/family, or the caret drifts.
 * Use RN Text (not AppText) so larger-text scaling cannot desync the layers.
 */
function ComposerHighlightedText({
  text,
  textStyle,
  foreground,
  tagColor,
}: {
  text: string;
  textStyle: TextStyle;
  foreground: string;
  tagColor: string;
}) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_TOKEN_RE.lastIndex = 0;
  while ((match = TAG_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <RNText
          key={`plain-${lastIndex}`}
          style={{ color: foreground }}
        >
          {text.slice(lastIndex, match.index)}
        </RNText>,
      );
    }
    nodes.push(
      <RNText
        key={`tag-${match.index}`}
        style={{ color: tagColor }}
      >
        {match[0]}
      </RNText>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length || nodes.length === 0) {
    nodes.push(
      <RNText
        key={`plain-${lastIndex}`}
        style={{ color: foreground }}
      >
        {text.slice(lastIndex)}
      </RNText>,
    );
  }

  return (
    <RNText
      pointerEvents='none'
      style={[textStyle, styles.highlightLayer]}
    >
      {nodes}
      {text.endsWith('\n') ? '\n' : null}
    </RNText>
  );
}

function AttachButton() {
  const { colors } = useTheme();
  const aui = useAui();

  const openWebFilePicker = (acceptTypes: string) => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptTypes;
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUri = reader.result as string;
            aui.composer.addAttachment({
              name: file.name,
              type: 'image',
              contentType: file.type,
              content: [{ type: 'image', image: dataUri }],
            });
          };
          reader.readAsDataURL(file);
        } else {
          aui.composer.addAttachment({
            name: file.name,
            type: 'document',
            contentType: file.type,
            content: [{ type: 'text', text: `[Attached file: ${file.name}]` }],
          });
        }
      }
    };
    input.click();
  };

  const handleNativePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (result.canceled || !result.assets?.length) return;

    for (const asset of result.assets) {
      aui.composer.addAttachment({
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: 'image',
        contentType: asset.mimeType || 'image/jpeg',
        content: [{ type: 'image', image: asset.uri }],
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
      const isImage = asset.mimeType?.startsWith('image/');
      if (isImage) {
        aui.composer.addAttachment({
          name: asset.name,
          type: 'image',
          contentType: asset.mimeType,
          content: [{ type: 'image', image: asset.uri }],
        });
      } else {
        aui.composer.addAttachment({
          name: asset.name,
          type: 'document',
          contentType: asset.mimeType,
          content: [{ type: 'text', text: `[Attached document: ${asset.name}]` }],
        });
      }
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

function SendButton() {
  const { colors } = useTheme();
  const canSend = useAuiState((s) => s.composer.canSend);

  return (
    <ComposerPrimitive.Send
      accessibilityLabel='Send message'
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

/** Local buffer avoids RN cursor jumps from store-controlled TextInput. */
function ComposerInput(props: TextInputProps) {
  const { colors, isDark } = useTheme();
  const aui = useAui();
  const storeText = useAuiState((s) => s.composer.text);
  const [localText, setLocalText] = useState(storeText);
  const [tagProfiles, setTagProfiles] = useState<FinoraTagSuggestion[]>([]);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const tagColor = isDark ? TAG_ACCENT.dark : TAG_ACCENT.light;
  // Keep overlay mode stable while editing so deleting a tag never remounts styles.
  const useHighlightOverlay = localText.length > 0;

  useEffect(() => {
    setLocalText((prev) => (prev !== storeText ? storeText : prev));
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
    setLocalText(next);
    aui.composer.setText(next);
    haptics.selection();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const emptyHint =
    mentionQuery !== null && mentionQuery.length < FINORA_TAG_GLOBAL_MIN_CHARS
      ? 'Recent Finora recipients only. Type the full tag or 3+ characters.'
      : 'No recent match. Type the exact Finora Tag to send.';

  const { style: inputStyleProp, ...inputProps } = props;
  const flatInputStyle = StyleSheet.flatten(inputStyleProp) ?? {};
  const overlayTextStyle: TextStyle = {
    fontFamily: flatInputStyle.fontFamily,
    fontSize: flatInputStyle.fontSize,
    lineHeight: flatInputStyle.lineHeight,
    fontWeight: flatInputStyle.fontWeight,
    letterSpacing: flatInputStyle.letterSpacing,
    paddingHorizontal: flatInputStyle.paddingHorizontal,
    paddingTop: flatInputStyle.paddingTop,
    paddingBottom: flatInputStyle.paddingBottom,
    paddingLeft: flatInputStyle.paddingLeft,
    paddingRight: flatInputStyle.paddingRight,
    padding: flatInputStyle.padding,
    textAlign: flatInputStyle.textAlign,
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'top' as const },
      default: {},
    }),
  };

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
                    @{profile.tag} · {profile.source === 'exact' ? 'Exact match' : 'Finora wallet'}
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
      <View style={styles.highlightWrap}>
        {useHighlightOverlay ? (
          <ComposerHighlightedText
            text={localText}
            textStyle={overlayTextStyle}
            foreground={colors.foreground}
            tagColor={tagColor}
          />
        ) : null}
        <TextInput
          {...inputProps}
          ref={inputRef}
          value={localText}
          style={[
            inputStyleProp,
            useHighlightOverlay && styles.transparentInput,
            Platform.select({
              android: { includeFontPadding: false, textAlignVertical: 'top' },
              web: useHighlightOverlay ? ({ caretColor: colors.foreground } as object) : undefined,
              default: {},
            }),
          ]}
          selectionColor={tagColor}
          onChangeText={(text) => {
            setLocalText(text);
            aui.composer.setText(text);
          }}
        />
      </View>
    </View>
  );
}

export function Composer() {
  const { colors } = useTheme();
  const inputStyle = useMemo(
    () => [styles.input, { color: colors.foreground }],
    [colors.foreground],
  );

  return (
    <View style={styles.container}>
      <View
        style={[styles.shell, { backgroundColor: colors.composer, borderColor: colors.border }]}
      >
        <ComposerPrimitive.Attachments components={COMPOSER_ATTACHMENT_COMPONENTS} />

        <ComposerInput
          style={inputStyle}
          placeholder='Ask Finora… use @ to tag'
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={4000}
        />

        <View style={styles.actionRow}>
          <AttachButton />
          <ScanButton />
          <View style={styles.spacer} />
          <AuiIf condition={(s) => !s.thread.isRunning}>
            <SendButton />
          </AuiIf>
          <AuiIf condition={(s) => s.thread.isRunning}>
            <CancelButton />
          </AuiIf>
        </View>
      </View>
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
  highlightWrap: {
    position: 'relative',
    width: '100%',
  },
  highlightLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  transparentInput: {
    color: 'transparent',
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
});
