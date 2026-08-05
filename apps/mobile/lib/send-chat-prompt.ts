type ThreadSender = {
  thread: {
    getState: () => { isRunning: boolean };
    append: (message: {
      role?: 'assistant' | 'user' | 'system';
      content: { type: 'text'; text: string }[];
    }) => void;
  };
};

export type { ThreadSender };

/**
 * Send a user message from tool UIs / cards.
 * Prefer this over `aui.composer.setText` + `send` — message-scoped tool
 * renders do not always have a thread composer ("Composer is not available").
 */
export function sendChatPrompt(aui: ThreadSender, text: string) {
  if (aui.thread.getState().isRunning) return;
  aui.thread.append({
    role: 'user',
    content: [{ type: 'text', text }],
  });
}
