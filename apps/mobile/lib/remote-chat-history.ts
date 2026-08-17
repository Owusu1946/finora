import type { UIMessage } from 'ai';

export function canonicalizeRemoteChatHistory(stored: UIMessage[], local: UIMessage[]) {
  const latestUserMessage = local.findLast((message) => message.role === 'user');
  if (!latestUserMessage || stored.some((message) => message.id === latestUserMessage.id)) {
    return stored;
  }
  return [...stored, latestUserMessage];
}
