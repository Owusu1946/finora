import {
  useAuiState,
  AuiIf,
  MessagePrimitive,
  ErrorPrimitive,
  groupPartByType,
  type TextMessagePartComponent,
} from "@assistant-ui/react-native";
import { useEffect, useRef } from "react";
import { View, Text, Animated, Platform, StyleSheet } from "react-native";

import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import {
  MessageImageAttachment,
  MessageDocumentAttachment,
  MessageAttachmentPill,
} from "./attachment";
import { EditComposer } from "./edit-composer";
import { MessageActionBar } from "./message-action-bar";
import { MessageBranchPicker } from "./message-branch-picker";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "./reasoning";
import { ToolFallback, ToolGroupContent, ToolGroupRoot, ToolGroupTrigger } from "./tool-group";

const UserText: TextMessagePartComponent = ({ text }) => {
  const { colors } = useTheme();
  return <Text style={[styles.userText, { color: colors.foreground }]}>{text}</Text>;
};

const AssistantText: TextMessagePartComponent = ({ text }) => {
  const { colors } = useTheme();
  return <Text style={[styles.assistantText, { color: colors.foreground }]}>{text}</Text>;
};

function TypingDot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, delay]);

  return (
    <Animated.View style={[styles.dot, { opacity, backgroundColor: colors.mutedForeground }]} />
  );
}

function TypingIndicator() {
  const isRunning = useAuiState((s) => s.message.status?.type === "running");
  if (!isRunning) return null;

  return (
    <View style={styles.typing}>
      <TypingDot delay={0} />
      <TypingDot delay={160} />
      <TypingDot delay={320} />
    </View>
  );
}

function UserMessage() {
  const { colors } = useTheme();
  return (
    <MessagePrimitive.Root style={styles.userContainer}>
      {/* Normal view (not editing) */}
      <AuiIf condition={(s) => !s.message.composer.isEditing}>
        <View style={[styles.userBubble, { backgroundColor: colors.muted }]}>
          <MessagePrimitive.Parts components={{ Text: UserText }} />
        </View>
        {/* User message attachments */}
        <MessagePrimitive.Attachments
          components={{
            Image: MessageImageAttachment,
            Document: MessageDocumentAttachment,
            File: MessageDocumentAttachment,
            Attachment: MessageAttachmentPill,
          }}
        />
        <View style={styles.actionsRow}>
          <MessageBranchPicker align="flex-end" />
          <MessageActionBar />
        </View>
      </AuiIf>

      {/* Edit mode */}
      <AuiIf condition={(s) => s.message.composer.isEditing}>
        <View style={styles.editContainer}>
          <EditComposer />
        </View>
      </AuiIf>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  const { colors } = useTheme();
  return (
    <MessagePrimitive.Root style={styles.assistantContainer}>
      <View style={styles.assistantContent}>
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return <View style={styles.chain}>{children}</View>;
              case "group-reasoning": {
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot streaming={running}>
                    <ReasoningTrigger active={running} />
                    <ReasoningContent>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "group-tool":
                return (
                  <ToolGroupRoot>
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "text":
                return <AssistantText {...part} />;
              case "reasoning":
                return <Reasoning {...part} />;
              case "tool-call":
                return part.toolUI ?? <ToolFallback {...part} />;
              case "indicator":
                return <TypingIndicator />;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>

        <ErrorPrimitive.Root
          style={[
            styles.error,
            {
              backgroundColor: colors.destructiveSurface,
              borderColor: colors.destructive,
            },
          ]}
        >
          <ErrorPrimitive.Message style={[styles.errorText, { color: colors.destructive }]} />
        </ErrorPrimitive.Root>
      </View>
      <MessagePrimitive.If running={false}>
        <View style={styles.actionsRow}>
          <MessageBranchPicker align="flex-start" />
          <MessageActionBar />
        </View>
      </MessagePrimitive.If>
    </MessagePrimitive.Root>
  );
}

export function MessageBubble() {
  const role = useAuiState((s) => s.message.role);
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
}

const styles = StyleSheet.create({
  userContainer: {
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.bubble,
  },
  editContainer: {
    width: "100%",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  assistantContent: {
    width: "100%",
    paddingHorizontal: 2,
  },
  chain: {
    width: "100%",
    marginBottom: 4,
  },
  userText: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  assistantText: {
    fontSize: 16,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    marginLeft: -4,
  },
  error: {
    marginTop: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
