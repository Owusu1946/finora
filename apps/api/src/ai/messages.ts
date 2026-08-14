import type { UIMessage } from 'ai';

const MAX_CHAT_TEXT_LENGTH = 120_000;

function sanitizeMessage(message: UIMessage): UIMessage {
  const parts: UIMessage['parts'] = [];
  for (const part of message.parts) {
    if (part.type === 'text') parts.push({ type: 'text', text: part.text });
    if (part.type === 'step-start') parts.push({ type: 'step-start' });
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

    let hasText = false;
    for (const part of message.parts) {
      if (part.type === 'text') {
        textLength += part.text.length;
        hasText ||= part.text.trim().length > 0;
        continue;
      }
      if (message.role === 'assistant' && part.type === 'step-start') continue;
      return null;
    }
    if (!hasText) return null;
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
  return left.parts.every((leftPart, index) => {
    const rightPart = right.parts[index];
    if (leftPart.type !== rightPart?.type) return false;
    if (leftPart.type === 'text' && rightPart.type === 'text') {
      return leftPart.text === rightPart.text;
    }
    return leftPart.type === 'step-start';
  });
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
    if (incoming.length !== stored.length + 1) return null;
    return isStoredPrefix(stored, incoming) ? incoming : null;
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
  const lastMessage = sanitized.at(-1);
  const hasAssistantText =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some((part) => part.type === 'text' && part.text.trim().length > 0);
  return hasAssistantText ? sanitized : originalMessages;
}
