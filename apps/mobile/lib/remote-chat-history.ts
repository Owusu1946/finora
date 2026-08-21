import type { UIMessage } from 'ai';

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

export function canonicalizeRemoteChatHistory(stored: UIMessage[], local: UIMessage[]) {
  if (stored.length === 0) {
    const latestUserMessage = local.findLast((message) => message.role === 'user');
    return latestUserMessage ? [latestUserMessage] : [];
  }

  const storedIsPrefixOfLocal = stored.every((message, index) =>
    messagesMatch(message, local[index]!),
  );
  if (storedIsPrefixOfLocal) {
    return [...stored, ...local.slice(stored.length)];
  }

  const latestUserMessage = local.findLast((message) => message.role === 'user');
  if (!latestUserMessage || stored.some((message) => message.id === latestUserMessage.id)) {
    return stored;
  }
  return [...stored, latestUserMessage];
}
