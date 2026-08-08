import { useAui, useAuiState, AuiIf, ComposerPrimitive } from '@assistant-ui/react-native';
import { useRouter } from 'expo-router';
import {
  View,
  Platform,
  ActionSheetIOS,
  Alert,
  Keyboard,
  StyleSheet,
  Pressable,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Rounded, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

import {
  ComposerImageAttachment,
  ComposerDocumentAttachment,
  ComposerAttachmentChip,
} from './attachment';

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
    try {
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        for (const asset of result.assets) {
          aui.composer.addAttachment({
            name: asset.fileName || `image_${Date.now()}.jpg`,
            type: 'image',
            contentType: asset.mimeType || 'image/jpeg',
            content: [{ type: 'image', image: asset.uri }],
          });
        }
      }
    } catch {
      aui.composer.addAttachment({
        name: 'photo.jpg',
        type: 'image',
        contentType: 'image/jpeg',
        content: [
          {
            type: 'image',
            image: 'https://picsum.photos/400/300',
          },
        ],
      });
    }
  };

  const handleNativePickDocument = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets) {
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
      }
    } catch {
      aui.composer.addAttachment({
        name: 'statement.pdf',
        type: 'document',
        contentType: 'application/pdf',
        content: [{ type: 'text', text: '[Attached document: statement.pdf]' }],
      });
    }
  };

  const handlePress = () => {
    haptics.selection();
    if (Platform.OS === 'web' || typeof document !== 'undefined') {
      openWebFilePicker('image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.csv,.json');
    } else {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Photo Library', 'Choose Document'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) handleNativePickImage();
            else if (buttonIndex === 2) handleNativePickDocument();
          },
        );
      } else {
        Alert.alert('Add Attachment', 'Choose attachment type', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Photo', onPress: handleNativePickImage },
          { text: 'Document', onPress: handleNativePickDocument },
        ]);
      }
    }
  };

  return (
    <ComposerPrimitive.AddAttachment
      accessibilityLabel='Attach file or photo'
      onPressIn={handlePress}
      style={({ pressed }: { pressed: boolean }) => [
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
    </ComposerPrimitive.AddAttachment>
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

export function Composer() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[styles.shell, { backgroundColor: colors.composer, borderColor: colors.border }]}
      >
        {/* Attachment chips row */}
        <ComposerPrimitive.Attachments
          components={{
            Image: ComposerImageAttachment,
            Document: ComposerDocumentAttachment,
            File: ComposerDocumentAttachment,
            Attachment: ComposerAttachmentChip,
          }}
        />

        <ComposerPrimitive.Input
          style={[styles.input, { color: colors.foreground }]}
          placeholder='Ask Finora…'
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
