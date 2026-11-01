import type { UIMessage } from 'ai';

import type { Database } from '../db/client';

import { postToAutomationsChat } from '../automations/deliver';
import { buildHighlights } from './highlights';
import { loadInsights, recentlyActiveUsers } from './service';

const DAY_MS = 86_400_000;
/** Weekly insights go out on Mondays at 08:00 UTC. */
const WEEKLY_DAY_UTC = 1;
const WEEKLY_HOUR_UTC = 8;

export function isWeeklyInsightMinute(now: Date) {
  return (
    now.getUTCDay() === WEEKLY_DAY_UTC &&
    now.getUTCHours() === WEEKLY_HOUR_UTC &&
    now.getUTCMinutes() === 0
  );
}

/**
 * The weekly message, or null when the week has nothing worth saying beyond
 * the totals (no change, no double payment, no low-balance warning, no bills).
 */
export function weeklyInsightMessage(messageId: string, highlights: string[]): UIMessage | null {
  if (highlights.length < 2) return null;
  return {
    id: messageId,
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: `Your week in money:\n\n${highlights.map((line) => `- ${line}`).join('\n')}\n\nAsk me for a full report or to plan what's due.`,
      },
    ],
  };
}

/** Posts this week's insights to the Automations chat of everyone who moved money lately. */
export async function postWeeklyInsights(db: Database, now = new Date()) {
  const users = await recentlyActiveUsers(db, new Date(now.getTime() - 14 * DAY_MS));
  const week = now.toISOString().slice(0, 10);
  let posted = 0;
  for (const userId of users) {
    try {
      const insights = await loadInsights(db, userId, { period: 'week', now });
      const message = weeklyInsightMessage(`insights_${week}`, buildHighlights(insights));
      if (!message) continue;
      await postToAutomationsChat(db, userId, message);
      posted += 1;
    } catch (error) {
      console.error('[insights:weekly]', {
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
  }
  return posted;
}
