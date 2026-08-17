import type { UIMessage } from 'ai';

import { isChatAgentToolName } from './tools';

const MAX_CHAT_TEXT_LENGTH = 120_000;

type UIMessagePart = UIMessage['parts'][number];
type DynamicToolPart = Extract<UIMessagePart, { type: 'dynamic-tool' }>;

function asToolPart(part: UIMessagePart) {
  if (part.type === 'dynamic-tool') {
    return { name: part.toolName, part };
  }
  if (!part.type.startsWith('tool-')) return null;
  return { name: part.type.slice('tool-'.length), part };
}

function sanitizeToolPart(part: UIMessagePart): DynamicToolPart | null {
  const tool = asToolPart(part);
  if (!tool || !isChatAgentToolName(tool.name)) return null;

  const value = tool.part as UIMessagePart & {
    toolCallId: string;
    state: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  };
  const base = {
    type: 'dynamic-tool' as const,
    toolName: tool.name,
    toolCallId: value.toolCallId,
  };

  if (value.state === 'output-available') {
    return {
      ...base,
      state: 'output-available',
      input: value.input ?? {},
      output: value.output ?? null,
    };
  }
  if (value.state === 'output-error') {
    return {
      ...base,
      state: 'output-error',
      input: value.input ?? {},
      errorText: value.errorText ?? 'Tool execution failed.',
    };
  }
  return null;
}

function sanitizeMessage(message: UIMessage): UIMessage {
  const parts: UIMessage['parts'] = [];
  for (const part of message.parts) {
    if (part.type === 'text') parts.push({ type: 'text', text: part.text });
    if (part.type === 'step-start') parts.push({ type: 'step-start' });
    if (message.role === 'assistant') {
      const toolPart = sanitizeToolPart(part);
      if (toolPart) parts.push(toolPart);
    }
  }

  return {
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    parts,
  };
}

export function sanitizeIncomingMessages(messages: UIMessage[]) {
  const messageIds = new Set<string>();
  let textLength = 0;

  for (const message of messages) {
    if (messageIds.has(message.id)) return null;
    messageIds.add(message.id);
    if (message.role !== 'user' && message.role !== 'assistant') return null;
    if (message.metadata !== undefined) return null;

    let hasContent = false;
    for (const part of message.parts) {
      if (part.type === 'text') {
        textLength += part.text.length;
        hasContent ||= part.text.trim().length > 0;
        continue;
      }
      if (message.role === 'assistant' && part.type === 'step-start') continue;
      if (message.role === 'assistant' && sanitizeToolPart(part)) {
        hasContent = true;
        continue;
      }
      return null;
    }
    if (!hasContent) return null;
  }

  if (messages.at(-1)?.role !== 'user' || textLength > MAX_CHAT_TEXT_LENGTH) return null;
  return messages.map(sanitizeMessage);
}

function messagesMatch(left: UIMessage, right: UIMessage) {
  if (
    left.id !== right.id ||
    left.role !== right.role ||
    left.parts.length !== right.parts.length
  ) {
    return false;
  }
  return left.parts.every(
    (leftPart, index) => JSON.stringify(leftPart) === JSON.stringify(right.parts[index]),
  );
}

function isStoredPrefix(stored: UIMessage[], incoming: UIMessage[]) {
  return stored.every((message, index) => messagesMatch(message, incoming[index]!));
}

export function reconcileChatMessages(
  stored: UIMessage[],
  incoming: UIMessage[],
  trigger: 'submit-message' | 'regenerate-message',
  messageId?: string,
) {
  if (stored.length === 0) return incoming.length === 1 ? incoming : null;

  if (trigger === 'submit-message') {
    const pendingMessage = incoming.at(-1);
    if (!pendingMessage || pendingMessage.role !== 'user') return null;
    if (stored.some((message) => message.id === pendingMessage.id)) return null;

    const incomingBase = incoming.slice(0, -1);
    if (incomingBase.length === stored.length && isStoredPrefix(stored, incomingBase)) {
      return incoming;
    }

    // The previous stream can finish persisting between the client's state read and submit.
    // Preserve the newer server history and append only the pending user turn.
    if (incomingBase.length <= stored.length && isStoredPrefix(incomingBase, stored)) {
      return [...stored, pendingMessage];
    }
    return null;
  }

  if (incoming.length > stored.length || !isStoredPrefix(incoming, stored)) return null;
  if (messageId !== undefined) {
    const targetIndex = stored.findIndex((message) => message.id === messageId);
    if (targetIndex !== incoming.length && targetIndex !== incoming.length - 1) return null;
  }
  return incoming;
}

export function generatedMessagesForPersistence(
  generated: UIMessage[],
  originalMessages: UIMessage[],
) {
  const sanitized = generated.map(sanitizeMessage);
  let lastUserIndex = -1;
  for (let index = sanitized.length - 1; index >= 0; index -= 1) {
    if (sanitized[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  const hasAssistantContent = sanitized
    .slice(lastUserIndex + 1)
    .some(
      (message) =>
        message.role === 'assistant' &&
        message.parts.some(
          (part) =>
            (part.type === 'text' && part.text.trim().length > 0) || part.type === 'dynamic-tool',
        ),
    );
  return hasAssistantContent ? sanitized : originalMessages;
}
