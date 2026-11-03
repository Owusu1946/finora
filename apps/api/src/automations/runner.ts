import { describeAutomationAction } from '@finora/shared';
import { and, eq } from 'drizzle-orm';

import {
  evaluateAutomation,
  listActiveAutomations,
  markAutomationEvaluation,
  recordAutomationLog,
} from '../db/automation-store';
import { createDb } from '../db/client';
import { automationExecutionLogs, automations } from '../db/schema';
import { getApiEnv } from '../env';
import { automationMessage, postToAutomationsChat } from './deliver';
import { enqueueDueInvoiceEvents, isDailyInvoiceScanMinute } from './producers';
import { AutomationQueueMessageSchema, type AutomationQueueMessage } from './queue';

/** Attempts before a failed delivery is logged instead of retried. */
const MAX_DELIVERY_ATTEMPTS = 3;

export async function enqueueDueAutomations(bindings: Env, now = new Date()) {
  const env = getApiEnv(bindings);
  const db = createDb(env.DATABASE_URL);
  const rows = await listActiveAutomations(db);
  let queued = 0;
  for (const row of rows) {
    if (row.trigger.type !== 'schedule') continue;
    const parts = row.trigger.config.time.split(':').map(Number);
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: row.trigger.config.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(local.find((part) => part.type === 'hour')?.value);
    const minute = Number(local.find((part) => part.type === 'minute')?.value);
    if (hour !== parts[0] || minute !== parts[1]) continue;
    const eventId = `schedule:${row.id}:${new Intl.DateTimeFormat('en-CA', { timeZone: row.trigger.config.timezone }).format(now)}:${hour}:${minute}`;
    await bindings.AUTOMATION_QUEUE.send({
      kind: 'evaluate',
      automationId: row.id,
      eventId,
      context: { now: now.toISOString() },
    } satisfies AutomationQueueMessage);
    queued += 1;
  }
  if (isDailyInvoiceScanMinute(now)) {
    queued += await enqueueDueInvoiceEvents(db, bindings.AUTOMATION_QUEUE, rows, now);
  }
  return queued;
}

export async function runAutomationMessage(message: Message<unknown>, bindings: Env) {
  const parsed = AutomationQueueMessageSchema.safeParse(message.body);
  if (!parsed.success) {
    message.ack();
    return;
  }
  const env = getApiEnv(bindings);
  const db = createDb(env.DATABASE_URL);
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, parsed.data.automationId), eq(automations.status, 'active')))
    .limit(1);
  if (!row) {
    message.ack();
    return;
  }
  const duplicate = await db
    .select({ id: automationExecutionLogs.id })
    .from(automationExecutionLogs)
    .where(
      and(
        eq(automationExecutionLogs.automationId, row.id),
        eq(automationExecutionLogs.eventId, parsed.data.eventId),
      ),
    )
    .limit(1);
  if (duplicate.length > 0) {
    message.ack();
    return;
  }

  const { event, ...context } = parsed.data.context;
  const forced = parsed.data.forced === true;
  if (!forced) {
    const result = evaluateAutomation({
      trigger: row.trigger,
      conditions: row.conditions,
      context,
      now: context.now ? new Date(context.now) : new Date(),
    });
    if (!result.matched) {
      await recordAutomationLog(db, {
        automationId: row.id,
        clerkUserId: row.clerkUserId,
        eventId: parsed.data.eventId,
        status: 'skipped_condition',
        summary: 'Automation evaluated but its trigger or conditions did not match.',
        details: { failedConditions: result.failedConditions },
      });
      await markAutomationEvaluation(db, row.id, 'skipped', false);
      message.ack();
      return;
    }
    if (
      row.cooldownSeconds > 0 &&
      row.lastTriggeredAt &&
      Date.now() - row.lastTriggeredAt.getTime() < row.cooldownSeconds * 1000
    ) {
      await recordAutomationLog(db, {
        automationId: row.id,
        clerkUserId: row.clerkUserId,
        eventId: parsed.data.eventId,
        status: 'duplicate',
        summary: 'Automation skipped because its cooldown is still active.',
      });
      message.ack();
      return;
    }
  }

  const notify = row.action.type === 'notify_chat';
  try {
    const chatId = await postToAutomationsChat(
      db,
      row.clerkUserId,
      automationMessage({
        messageId: `automation-${crypto.randomUUID()}`,
        automation: { id: row.id, name: row.name, action: row.action },
        event,
      }),
    );
    await recordAutomationLog(db, {
      automationId: row.id,
      clerkUserId: row.clerkUserId,
      eventId: parsed.data.eventId,
      status: notify ? 'notified' : 'prepared_approval',
      summary: notify
        ? row.action.type === 'notify_chat'
          ? row.action.config.message
          : row.name
        : `Ready to ${describeAutomationAction(row.action)}.`,
      details: { chatId, forced, ...(event ? { event } : {}) },
    });
  } catch (error) {
    if (message.attempts < MAX_DELIVERY_ATTEMPTS) {
      message.retry({ delaySeconds: 30 });
      return;
    }
    console.error('[automations:deliver]', {
      automationId: row.id,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    await recordAutomationLog(db, {
      automationId: row.id,
      clerkUserId: row.clerkUserId,
      eventId: parsed.data.eventId,
      status: 'failed',
      summary: "The automation ran but couldn't post to your Automations chat.",
      errorCode: 'delivery_failed',
    });
    await markAutomationEvaluation(db, row.id, 'failed', false);
    message.ack();
    return;
  }

  await markAutomationEvaluation(db, row.id, 'success', true);
  // A one-time schedule has done its job.
  if (!forced && row.trigger.type === 'schedule' && row.trigger.config.frequency === 'once') {
    await db.update(automations).set({ status: 'paused' }).where(eq(automations.id, row.id));
  }
  message.ack();
}
