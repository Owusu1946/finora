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
import { resolveChatActivity } from './chat-activity';
import { EditComposer } from './edit-composer';
import { AssistantMarkdownText } from './markdown-text';
import { MessageActionBar } from './message-action-bar';
import { MessageBranchPicker } from './message-branch-picker';

const USER_MESSAGE_COLLAPSED_LINES = 6;
const USER_MESSAGE_COLLAPSED_CHARACTERS = 240;

const UserText: TextMessagePartComponent = ({ text }) => {
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
    <View className='max-w-[100%] items-start gap-[7px]'>
      <Text
        selectable
        numberOfLines={isCollapsible && !expanded ? USER_MESSAGE_COLLAPSED_LINES : undefined}
        onTextLayout={(event) => {
          if (event.nativeEvent.lines.length > USER_MESSAGE_COLLAPSED_LINES) {
            setIsCollapsible(true);
          }
        }}
        className='font-sans text-[17px] leading-[22px] tracking-[0px] text-foreground'
      >
        {text}
      </Text>
      {isCollapsible ? (
        <Pressable
          accessibilityLabel={expanded ? 'Show less of this message' : 'Show all of this message'}
          hitSlop={8}
          onPress={() => setExpanded((current) => !current)}
          className='min-h-6 justify-center px-0.5'
          style={({ pressed }) => [pressed && styles.expandButtonPressed]}
        >
          <Text className='font-sans-semibold text-[13px] leading-[18px] tracking-[0px] text-muted-foreground'>
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
  const { isDark } = useTheme();
  if (!isRunning) return null;
  const activity = resolveChatActivity(parts);

  const label = activity.label;

  return (
    <View
      className='flex-row items-center gap-2 py-2'
      accessibilityLabel={label}
      accessibilityLiveRegion='polite'
    >
      <ThinkingOrb
        state={activity.orbState}
        size={20}
        speed={1.5}
        theme={isDark ? 'dark' : 'light'}
        accessibilityLabel={label}
      />
      <Text className='font-sans text-[15px] leading-[20px] text-muted-foreground'>{label}</Text>
    </View>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root style={styles.userContainer}>
      {/* Normal view (not editing) */}
      <AuiIf condition={(s) => !s.message.composer.isEditing}>
        <View
          className='max-w-[82%] border px-4 py-3 overflow-hidden bg-muted border-border'
          style={[styles.userBubble]}
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
        <View className='flex-row items-center gap-1 mt-1.5 -ml-1'>
          <MessageBranchPicker align='flex-end' />
          <MessageActionBar />
        </View>
      </AuiIf>

      {/* Edit mode */}
      <AuiIf condition={(s) => s.message.composer.isEditing}>
        <View className='w-[100%]'>
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
      <View className='w-[100%] px-0.5'>
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
                return <View className='w-[100%] mb-1'>{children}</View>;
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
        <View className='flex-row items-center gap-1 mt-1.5 -ml-1'>
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

const styles = {
  userContainer: {
    alignItems: 'flex-end',
  },
  userBubble: {
    ...Rounded,
    borderRadius: Radius.lg,
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  expandButtonPressed: {
    opacity: 0.55,
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
} as const;
