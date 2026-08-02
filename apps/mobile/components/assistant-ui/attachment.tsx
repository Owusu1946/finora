import { AttachmentPrimitive, useAuiState } from "@assistant-ui/react-native";
import { Image as ExpoImage } from "expo-image";
import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { haptics } from "@/lib/haptics";

function useAttachmentPreview() {
  const attachment = useAuiState((s) => s.attachment);
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) {
      setImageUri(null);
      return;
    }

    // 1. If content contains an image part
    if (Array.isArray(attachment.content)) {
      const imgPart = (attachment.content as any[]).find((p: any) => p.type === "image");
      if (imgPart?.image) {
        setImageUri(imgPart.image);
        return;
      }
    }

    // 2. If file is an Image File (web / blob)
    if (
      attachment.file &&
      (attachment.contentType?.startsWith("image/") ||
        attachment.file.type?.startsWith("image/")) &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function"
    ) {
      try {
        const url = URL.createObjectURL(attachment.file);
        setImageUri(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch {
        // ignore
      }
    }

    setImageUri(null);
  }, [attachment]);

  return { attachment, imageUri };
}

/**
 * Image Attachment in Composer (Thumbnail with delete badge)
 */
export function ComposerImageAttachment() {
  const { colors } = useTheme();
  const { imageUri } = useAttachmentPreview();

  return (
    <AttachmentPrimitive.Root style={styles.imageChipContainer}>
      <View
        style={[styles.imageChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
      >
        {imageUri ? (
          <ExpoImage source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Icon name="image" size={20} color={colors.mutedForeground} />
          </View>
        )}
      </View>
      <AttachmentPrimitive.Remove
        onPressIn={haptics.light}
        style={styles.imageRemoveBadge}
        hitSlop={6}
      >
        <Icon name="close-circle" size={18} color={colors.foreground} />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

/**
 * Document Attachment in Composer (Chip with file icon, name, ext, and remove)
 */
export function ComposerDocumentAttachment() {
  const { colors } = useTheme();
  return (
    <AttachmentPrimitive.Root
      style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}
    >
      <View style={styles.chipContent}>
        <Icon name="file" size={15} color={colors.mutedForeground} />
        <AttachmentPrimitive.Name
          style={[styles.chipName, { color: colors.foreground }]}
          numberOfLines={1}
        />
        <AttachmentPrimitive.Thumb style={[styles.pillExt, { color: colors.mutedForeground }]} />
      </View>
      <AttachmentPrimitive.Remove
        onPressIn={haptics.light}
        style={({ pressed }: { pressed: boolean }) => [
          styles.removeButton,
          pressed && { opacity: 0.6 },
        ]}
        hitSlop={4}
      >
        <Icon name="close-circle" size={16} color={colors.mutedForeground} />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

/**
 * Fallback Composer Attachment Chip
 */
export function ComposerAttachmentChip() {
  const { attachment } = useAttachmentPreview();
  if (attachment?.type === "image" || attachment?.contentType?.startsWith("image/")) {
    return <ComposerImageAttachment />;
  }
  return <ComposerDocumentAttachment />;
}

/**
 * Image Attachment in Sent User Message
 */
export function MessageImageAttachment() {
  const { colors } = useTheme();
  const { imageUri } = useAttachmentPreview();

  return (
    <AttachmentPrimitive.Root style={styles.messageImageContainer}>
      {imageUri ? (
        <ExpoImage
          source={{ uri: imageUri }}
          style={styles.messageImagePreview}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.messageImagePlaceholder,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Icon name="image" size={24} color={colors.mutedForeground} />
          <AttachmentPrimitive.Name
            style={[styles.pillName, { color: colors.foreground }]}
            numberOfLines={1}
          />
        </View>
      )}
    </AttachmentPrimitive.Root>
  );
}

/**
 * Document Attachment in Sent User Message
 */
export function MessageDocumentAttachment() {
  const { colors } = useTheme();
  return (
    <AttachmentPrimitive.Root
      style={[styles.pill, { backgroundColor: colors.muted, borderColor: colors.border }]}
    >
      <Icon name="file" size={15} color={colors.mutedForeground} />
      <AttachmentPrimitive.Name
        style={[styles.pillName, { color: colors.foreground }]}
        numberOfLines={1}
      />
      <AttachmentPrimitive.Thumb style={[styles.pillExt, { color: colors.mutedForeground }]} />
    </AttachmentPrimitive.Root>
  );
}

/**
 * Fallback Message Attachment Pill
 */
export function MessageAttachmentPill() {
  const { attachment } = useAttachmentPreview();
  if (attachment?.type === "image" || attachment?.contentType?.startsWith("image/")) {
    return <MessageImageAttachment />;
  }
  return <MessageDocumentAttachment />;
}

const styles = StyleSheet.create({
  /* Composer Image */
  imageChipContainer: {
    position: "relative",
    marginRight: 6,
    marginVertical: 4,
  },
  imageChip: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageRemoveBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    borderRadius: Radius.pill,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  /* Composer Document */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.attachment,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 6,
    gap: 6,
    marginVertical: 4,
  },
  chipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  chipName: {
    fontSize: 13,
    maxWidth: 140,
  },
  removeButton: {
    padding: 2,
  },

  /* Message Image */
  messageImageContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  messageImagePreview: {
    width: 200,
    height: 150,
    borderRadius: Radius.card,
  },
  messageImagePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },

  /* Message Document */
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.attachment,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginTop: 6,
  },
  pillName: {
    fontSize: 13,
    maxWidth: 160,
    flexShrink: 1,
  },
  pillExt: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
