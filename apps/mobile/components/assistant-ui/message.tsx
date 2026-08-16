import {
  AuiIf,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  useAuiState,
  type TextMessagePartComponent,
} from '@assistant-ui/react-native';
import { ThinkingOrb } from '@mhaadi/thinking-orbs-native';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/ui/text';
import { Radius, Rounded } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  MessageAttachmentPill,
  MessageDocumentAttachment,
  MessageImageAttachment,
} from './attachment';
import { EditComposer } from './edit-composer';
import { AssistantMarkdownText } from './markdown-text';
import { MessageActionBar } from './message-action-bar';
import { MessageBranchPicker } from './message-branch-picker';

const USER_MESSAGE_COLLAPSED_LINES = 6;
const USER_MESSAGE_COLLAPSED_CHARACTERS = 240;

const UserText: TextMessagePartComponent = ({ text }) => {
  const { colors } = useTheme();
  const likelyLong =
    text.length > USER_MESSAGE_COLLAPSED_CHARACTERS ||
    text.split('\n').length > USER_MESSAGE_COLLAPSED_LINES;
  const [isCollapsible, setIsCollapsible] = useState(likelyLong);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setIsCollapsible(likelyLong);
    setExpanded(false);
  }, [likelyLong, text]);

  return (
    <View style={styles.userTextContent}>
      <Text
        selectable
        numberOfLines={isCollapsible && !expanded ? USER_MESSAGE_COLLAPSED_LINES : undefined}
        onTextLayout={(event) => {
          if (event.nativeEvent.lines.length > USER_MESSAGE_COLLAPSED_LINES) {
            setIsCollapsible(true);
          }
        }}
        style={[styles.userText, { color: colors.foreground }]}
      >
        {text}
      </Text>
      {isCollapsible ? (
        <Pressable
          accessibilityLabel={expanded ? 'Show less of this message' : 'Show all of this message'}
          hitSlop={8}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}
        >
          <Text style={[styles.expandLabel, { color: colors.mutedForeground }]}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

function TypingIndicator() {
  const isRunning = useAuiState((s) => s.message.status?.type === 'running');
  const parts = useAuiState((s) => s.message.parts);
  const { colors, isDark } = useTheme();
  if (!isRunning) return null;

  const activeTool = [...parts]
    .reverse()
    .find((part) => part.type === 'tool-call' && part.status.type === 'running');
  const label =
    activeTool?.type === 'tool-call' ? getToolStatusLabel(activeTool.toolName) : 'Working on that…';

  return (
    <View
      style={styles.typing}
      accessibilityLabel={label}
      accessibilityLiveRegion='polite'
    >
      <ThinkingOrb
        state='composing'
        size={20}
        speed={1.5}
        theme={isDark ? 'dark' : 'light'}
        accessibilityLabel={label}
      />
      <Text style={[styles.typingLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function getToolStatusLabel(toolName: string) {
  const labels: Record<string, string> = {
    get_balances: 'Loading wallet balances…',
    list_invoices: 'Checking unpaid invoices…',
    list_expenses: 'Loading business expenses…',
    generate_financial_insights: 'Preparing financial report…',
    list_calendar_dues: 'Checking upcoming dues…',
    list_receive_methods: 'Loading receive methods…',
    list_virtual_accounts: 'Loading virtual accounts…',
    list_virtual_cards: 'Loading virtual cards…',
  };
  if (labels[toolName]) return labels[toolName];
  return `${toolName.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase())}…`;
}

function UserMessage() {
  const { colors } = useTheme();
  return (
    <MessagePrimitive.Root style={styles.userContainer}>
      {/* Normal view (not editing) */}
      <AuiIf condition={(s) => !s.message.composer.isEditing}>
        <View
          style={[styles.userBubble, { backgroundColor: colors.muted, borderColor: colors.border }]}
        >
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
          <MessageBranchPicker align='flex-end' />
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
          indicator='always'
          groupBy={groupPartByType({
            reasoning: ['group-chainOfThought', 'group-reasoning'],
            'tool-call': ['group-chainOfThought', 'group-tool'],
            'standalone-tool-call': [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case 'group-chainOfThought':
                return <View style={styles.chain}>{children}</View>;
              case 'group-reasoning':
                return null;
              case 'group-tool':
                return children;
              case 'text':
                return <AssistantMarkdownText {...part} />;
              case 'reasoning':
                return null;
              case 'tool-call':
                return part.toolUI;
              case 'indicator':
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
          <MessageBranchPicker align='flex-start' />
          <MessageActionBar />
        </View>
      </MessagePrimitive.If>
    </MessagePrimitive.Root>
  );
}

export const MessageBubble = memo(function MessageBubble() {
  const role = useAuiState((s) => s.message.role);
  if (role === 'user') return <UserMessage />;
  return <AssistantMessage />;
});

const styles = StyleSheet.create({
  userContainer: {
    alignItems: 'flex-end',
  },
  userBubble: {
    ...Rounded,
    maxWidth: '82%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  editContainer: {
    width: '100%',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  assistantContent: {
    width: '100%',
    paddingHorizontal: 2,
  },
  chain: {
    width: '100%',
    marginBottom: 4,
  },
  userText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0,
  },
  userTextContent: {
    maxWidth: '100%',
    alignItems: 'flex-start',
    gap: 7,
  },
  expandButton: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  expandButtonPressed: {
    opacity: 0.55,
  },
  expandLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: -4,
  },
  error: {
    ...Rounded,
    marginTop: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 20,
  },
});
