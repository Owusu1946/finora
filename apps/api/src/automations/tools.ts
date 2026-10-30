import {
  CreateAutomationToolInputSchema,
  describeAutomation,
  ListAutomationsToolInputSchema,
  ManageAutomationToolInputSchema,
  type AutomationRecord,
} from '@finora/shared';
import { tool, zodSchema } from 'ai';

import type { Database } from '../db/client';
import type { AutomationQueueMessage } from './queue';

import { listAutomations, updateAutomation } from '../db/automation-store';

export const AUTOMATION_TOOL_NAMES = [
  'list_automations',
  'create_automation',
  'manage_automation',
] as const;

export type AutomationToolContext = {
  db: Database;
  userId: string;
  queue: { send: (message: AutomationQueueMessage) => Promise<unknown> };
  /** The user's IANA timezone, used for schedules that don't name one. */
  timezone: string;
};

/** What the model and the chat cards see for one automation. */
function automationSummary(automation: AutomationRecord) {
  return {
    id: automation.id,
    name: automation.name,
    status: automation.status,
    description: describeAutomation(automation),
    lastTriggeredAt: automation.lastTriggeredAt,
    lastRunStatus: automation.lastRunStatus,
    totalRuns: automation.totalRuns,
  };
}

export function isValidTimezone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function createAutomationTools(context: AutomationToolContext) {
  const { db, userId, queue } = context;

  /** Finds one automation by id, or by a name that matches exactly or uniquely. */
  async function resolve(input: { automationId?: string; name?: string }) {
    const all = await listAutomations(db, userId, undefined, 100);
    if (input.automationId) {
      const found = all.find((item) => item.id === input.automationId);
      return found ? { automation: found } : { errorCode: 'automation_not_found' as const };
    }
    const query = input.name?.trim().toLowerCase();
    if (!query) return { errorCode: 'automation_not_specified' as const };
    const exact = all.filter((item) => item.name.toLowerCase() === query);
    const matches = exact.length > 0 ? exact : all.filter((item) => item.name.toLowerCase().includes(query));
    if (matches.length === 1) return { automation: matches[0]! };
    if (matches.length === 0) return { errorCode: 'automation_not_found' as const };
    return {
      errorCode: 'automation_ambiguous' as const,
      candidates: matches.map((item) => ({ id: item.id, name: item.name })),
    };
  }

  return {
    list_automations: tool({
      description:
        "List the user's automations with what each does, whether it's on, and when it last ran.",
      inputSchema: zodSchema(ListAutomationsToolInputSchema),
      execute: async ({ status }) => ({
        automations: (await listAutomations(db, userId, status, 50)).map(automationSummary),
      }),
    }),

    create_automation: tool({
      description: `Draft an automation when the user asks Finora to do something on a schedule or when something happens: reminders ("every Monday at 8 remind me to check sales"), recurring preparations ("every 25th prepare rent to Kwame"), balance alerts ("tell me when USD drops below 5,000"), and invoice rules ("when an invoice is due in 3 days, prepare payment"). The chat shows the draft and the user turns it on; never say it's active until they do. Use notify_chat for reminders and alerts. For payments, put who to pay in action.config.recipient in the user's words. Automations only ever remind or prepare; money still needs approval and the passcode. Schedules use 24-hour time; when the user names no timezone use ${context.timezone}.`,
      inputSchema: zodSchema(CreateAutomationToolInputSchema),
      execute: async (input) => {
        const automation =
          input.trigger.type === 'schedule' && input.trigger.config.timezone === 'UTC'
            ? {
                ...input,
                trigger: {
                  ...input.trigger,
                  config: { ...input.trigger.config, timezone: context.timezone },
                },
              }
            : input;
        return {
          status: 'draft' as const,
          automation,
          description: describeAutomation(automation),
        };
      },
    }),

    manage_automation: tool({
      description:
        'Pause, resume, run now, or delete one of the user\'s automations, found by id or name. Pause, resume, and run now happen right away (run now posts the result to the Automations chat). Delete shows a confirmation the user taps.',
      inputSchema: zodSchema(ManageAutomationToolInputSchema),
      execute: async ({ automationId, name, operation }) => {
        const found = await resolve({ automationId, name });
        if (!('automation' in found) || !found.automation) return { ok: false as const, ...found };
        const automation = found.automation;

        if (operation === 'delete') {
          return {
            ok: true as const,
            status: 'confirm_delete' as const,
            automation: automationSummary(automation),
          };
        }
        if (operation === 'run_now') {
          if (automation.status !== 'active') {
            return { ok: false as const, errorCode: 'automation_paused', automation: automationSummary(automation) };
          }
          await queue.send({
            kind: 'evaluate',
            automationId: automation.id,
            eventId: `chat:${automation.id}:${Date.now()}`,
            forced: true,
            context: {},
          });
          return { ok: true as const, status: 'queued' as const, automation: automationSummary(automation) };
        }
        const updated = await updateAutomation(db, userId, {
          id: automation.id,
          status: operation === 'pause' ? 'paused' : 'active',
        });
        return updated
          ? { ok: true as const, status: 'updated' as const, automation: automationSummary(updated) }
          : { ok: false as const, errorCode: 'automation_not_found' };
      },
    }),
  };
}

export function automationsPrompt(timezone: string, now: Date) {
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(now);
  return `

# Automations
It is ${local} for the user (${timezone}).
When the user wants something to happen on a schedule or when something happens, draft it with create_automation instead of only describing it. Ask one short question only when a must-have detail is missing (when it should run, or who and how much to pay). Use list_automations to answer questions about their automations and manage_automation to pause, resume, run, or delete one.
Automations post to the user's Automations chat. Reminders arrive as messages. Money rules arrive as a card the user taps to prepare the payment, which then needs approval and the passcode. Never say an automation pays or moves money by itself.`;
}
