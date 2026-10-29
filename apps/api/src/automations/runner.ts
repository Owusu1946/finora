import type { AutomationAction } from '@finora/shared';

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
import { createPreparation } from '../mock/store';
import { AutomationQueueMessageSchema, type AutomationQueueMessage } from './queue';

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
  return queued;
}

function preparationForAction(action: AutomationAction, userId: string) {
  const type = action.type;
  const config = action.config;
  if (type === 'prepare_conversion') {
    if (action.type !== 'prepare_conversion') throw new Error('invalid_conversion_action');
    return createPreparation('conversion', {
      from: action.config.fromCurrency,
      to: action.config.toCurrency,
      amount: action.config.amount,
      automationUserId: userId,
    });
  }
  return createPreparation(type.replace('prepare_', '') as 'payment', {
    ...config,
    automationUserId: userId,
  });
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
  const result = evaluateAutomation({
    trigger: row.trigger,
    conditions: row.conditions,
    context: parsed.data.context as Parameters<typeof evaluateAutomation>[0]['context'],
    now: parsed.data.context.now ? new Date(parsed.data.context.now) : new Date(),
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
  if (row.action.type === 'notify_chat') {
    await recordAutomationLog(db, {
      automationId: row.id,
      clerkUserId: row.clerkUserId,
      eventId: parsed.data.eventId,
      status: 'notified',
      summary: row.action.config.message,
      details: { channel: 'chat' },
    });
  } else if (
    row.action.type === 'prepare_payment' ||
    row.action.type === 'prepare_invoice_payment' ||
    row.action.type === 'prepare_supplier_payment' ||
    row.action.type === 'prepare_payroll' ||
    row.action.type === 'prepare_conversion' ||
    row.action.type === 'prepare_internal_transfer'
  ) {
    const preparation = preparationForAction(row.action, row.clerkUserId);
    await recordAutomationLog(db, {
      automationId: row.id,
      clerkUserId: row.clerkUserId,
      eventId: parsed.data.eventId,
      status: 'prepared_approval',
      summary: 'Prepared an automation action for human approval.',
      details: { action: row.action },
      preparationId: preparation.preparationId,
      approvalId: preparation.approvalId,
    });
  } else {
    await recordAutomationLog(db, {
      automationId: row.id,
      clerkUserId: row.clerkUserId,
      eventId: parsed.data.eventId,
      status: 'failed',
      summary: 'Automation action is not supported by the worker.',
      errorCode: 'unsupported_action',
    });
    await markAutomationEvaluation(db, row.id, 'failed', false);
    message.ack();
    return;
  }
  await markAutomationEvaluation(db, row.id, 'success', true);
  message.ack();
}
