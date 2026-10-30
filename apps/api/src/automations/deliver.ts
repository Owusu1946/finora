import type { UIMessage } from 'ai';

import {
  AUTOMATIONS_CHAT_TITLE,
  automationPreparePrompt,
  describeAutomationAction,
  type AutomationAction,
} from '@finora/shared';
import { eq, max } from 'drizzle-orm';

import type { Database } from '../db/client';

import { aiChatMessages, aiChats } from '../db/schema';

/** Tool part name for a ready automation; rendered by the app, never called by the model. */
export const AUTOMATION_READY_PART = 'automation_ready';

/** Each user has one Automations chat that every rule posts to. */
export function automationsChatId(userId: string) {
  return `automations_${userId}`;
}

export type AutomationReadyOutput = {
  automationId: string;
  name: string;
  description: string;
  prompt: string;
};

/**
 * The chat message for one automation run. Reminders are plain text; rules
 * that prepare money carry a card the user taps to prepare it for approval.
 */
export function automationMessage(input: {
  messageId: string;
  automation: { id: string; name: string; action: AutomationAction };
  /** What set it off, e.g. "Invoice INV-104 from Acme, USD 500, due in 2 days". */
  event?: string;
}): UIMessage {
  const { automation, event } = input;
  const because = event ? ` ${event}.` : '';
  if (automation.action.type === 'notify_chat') {
    return {
      id: input.messageId,
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `${automation.name}: ${automation.action.config.message}${because}`,
        },
      ],
    };
  }
  const description = describeAutomationAction(automation.action);
  const prompt = automationPreparePrompt(automation.name, automation.action) ?? '';
  const output: AutomationReadyOutput = {
    automationId: automation.id,
    name: automation.name,
    description,
    prompt: event ? `${prompt} Details: ${event}.` : prompt,
  };
  return {
    id: input.messageId,
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: `Your automation "${automation.name}" ran.${because} It's ready to ${description}. Nothing moves until you approve it.`,
      },
      {
        type: 'dynamic-tool',
        toolName: AUTOMATION_READY_PART,
        toolCallId: `${AUTOMATION_READY_PART}_${input.messageId}`,
        state: 'output-available',
        input: { automationId: automation.id },
        output,
      },
    ],
  };
}

/**
 * Appends a message to the user's Automations chat, creating the chat (or
 * bringing it back if they deleted or archived it). Returns the chat id.
 */
export async function postToAutomationsChat(db: Database, userId: string, message: UIMessage) {
  const chatId = automationsChatId(userId);
  const now = new Date();
  await db
    .insert(aiChats)
    .values({
      id: chatId,
      clerkUserId: userId,
      title: AUTOMATIONS_CHAT_TITLE,
      titleStatus: 'generated',
    })
    .onConflictDoUpdate({
      target: aiChats.id,
      set: { deletedAt: null, archivedAt: null, updatedAt: now },
      where: eq(aiChats.clerkUserId, userId),
    });

  // Two runs can land at once; the position is unique, so retry on a clash.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [last] = await db
      .select({ position: max(aiChatMessages.position) })
      .from(aiChatMessages)
      .where(eq(aiChatMessages.chatId, chatId));
    try {
      await db
        .insert(aiChatMessages)
        .values({
          chatId,
          messageId: message.id,
          position: (last?.position ?? -1) + 1,
          role: 'assistant',
          payload: message,
        })
        .onConflictDoNothing({ target: [aiChatMessages.chatId, aiChatMessages.messageId] });
      return chatId;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  return chatId;
}
