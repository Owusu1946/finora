import type {
  AutomationCondition,
  AutomationRecord,
  CreateAutomationInput,
  TestAutomationInput,
  UpdateAutomationInput,
} from '@finora/shared';

import { and, desc, eq, gt, sql } from 'drizzle-orm';

import type { Database } from './client';

import { automationExecutionLogs, automations } from './schema';

function serialize(row: typeof automations.$inferSelect): AutomationRecord {
  return {
    id: row.id,
    userId: row.clerkUserId,
    name: row.name,
    description: row.description ?? undefined,
    trigger: row.trigger,
    conditions: row.conditions,
    action: row.action,
    status: row.status,
    cooldownSeconds: row.cooldownSeconds,
    version: row.version,
    lastEvaluatedAt: row.lastEvaluatedAt?.toISOString() ?? null,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    lastRunStatus: row.lastRunStatus,
    totalRuns: row.totalRuns,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAutomations(
  db: Database,
  userId: string,
  status?: 'active' | 'paused' | 'disabled',
  limit = 50,
) {
  const rows = await db
    .select()
    .from(automations)
    .where(
      and(eq(automations.clerkUserId, userId), status ? eq(automations.status, status) : undefined),
    )
    .orderBy(desc(automations.updatedAt))
    .limit(limit);
  return rows.map(serialize);
}

export async function getAutomation(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.clerkUserId, userId), eq(automations.id, id)))
    .limit(1);
  return row ? serialize(row) : null;
}

export async function createAutomation(db: Database, userId: string, input: CreateAutomationInput) {
  const [row] = await db
    .insert(automations)
    .values({
      clerkUserId: userId,
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      conditions: input.conditions,
      action: input.action,
      status: input.status,
      cooldownSeconds: input.cooldownSeconds,
    })
    .returning();
  return serialize(row!);
}

export async function updateAutomation(db: Database, userId: string, input: UpdateAutomationInput) {
  const values = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
    ...(input.conditions !== undefined ? { conditions: input.conditions } : {}),
    ...(input.action !== undefined ? { action: input.action } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.cooldownSeconds !== undefined ? { cooldownSeconds: input.cooldownSeconds } : {}),
    version: sql`${automations.version} + 1`,
    updatedAt: new Date(),
  };
  const [row] = await db
    .update(automations)
    .set(values)
    .where(and(eq(automations.clerkUserId, userId), eq(automations.id, input.id)))
    .returning();
  return row ? serialize(row) : null;
}

export async function listActiveAutomations(db: Database, limit = 500) {
  return db
    .select()
    .from(automations)
    .where(eq(automations.status, 'active'))
    .orderBy(desc(automations.updatedAt))
    .limit(limit);
}

export async function listActiveAutomationsForUser(db: Database, userId: string) {
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.clerkUserId, userId), eq(automations.status, 'active')));
}

export async function markAutomationEvaluation(
  db: Database,
  automationId: string,
  status: string,
  triggered: boolean,
) {
  const now = new Date();
  await db
    .update(automations)
    .set({
      lastEvaluatedAt: now,
      lastTriggeredAt: triggered ? now : undefined,
      lastRunStatus: status,
      totalRuns: sql`${automations.totalRuns} + 1`,
      updatedAt: now,
    })
    .where(eq(automations.id, automationId));
}

export async function recordAutomationLog(
  db: Database,
  input: typeof automationExecutionLogs.$inferInsert,
) {
  const [row] = await db.insert(automationExecutionLogs).values(input).returning();
  return row;
}

export async function deleteAutomation(db: Database, userId: string, id: string) {
  const deleted = await db
    .delete(automations)
    .where(and(eq(automations.clerkUserId, userId), eq(automations.id, id)))
    .returning({ id: automations.id });
  return deleted.length > 0;
}

function conditionMatches(condition: AutomationCondition, context: TestAutomationInput['context']) {
  switch (condition.type) {
    case 'amount_max':
      return (
        context.amount != null &&
        context.currency === condition.currency &&
        context.amount <= condition.amount
      );
    case 'amount_min':
      return (
        context.amount != null &&
        context.currency === condition.currency &&
        context.amount >= condition.amount
      );
    case 'currency_is':
      return context.currency === condition.currency;
    case 'supplier_is':
      return context.supplierId === condition.supplierId;
    case 'sender_domain_is':
      return context.senderDomain?.toLocaleLowerCase() === condition.domain.toLocaleLowerCase();
  }
}

export function evaluateAutomation(input: {
  trigger: AutomationRecord['trigger'];
  conditions: AutomationCondition[];
  context: TestAutomationInput['context'];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const trigger = input.trigger;
  let triggerMatches = true;
  if (trigger.type === 'balance_threshold') {
    const balance = input.context.walletBalance;
    triggerMatches =
      balance != null &&
      input.context.currency === trigger.config.currency &&
      (trigger.config.operator === 'below'
        ? balance < trigger.config.amount
        : balance > trigger.config.amount);
  } else if (trigger.type === 'gmail_invoice') {
    triggerMatches =
      trigger.config.senderDomains.length === 0 ||
      (input.context.senderDomain != null &&
        trigger.config.senderDomains.some(
          (domain) =>
            domain.toLocaleLowerCase() === input.context.senderDomain?.toLocaleLowerCase(),
        ));
  } else if (trigger.type === 'invoice_due') {
    triggerMatches =
      input.context.invoiceDueInDays != null &&
      input.context.invoiceDueInDays <= trigger.config.dueWithinDays;
  } else if (trigger.type === 'schedule') {
    const localParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: trigger.config.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => localParts.find((entry) => entry.type === type)?.value;
    const parts = trigger.config.time.split(':').map(Number);
    const hour = parts[0];
    const minute = parts[1];
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      part('weekday') ?? '',
    );
    triggerMatches = Number(part('hour')) === hour && Number(part('minute')) === minute;
    if (triggerMatches && trigger.config.frequency === 'weekdays')
      triggerMatches = weekday > 0 && weekday < 6;
    if (triggerMatches && trigger.config.frequency === 'weekly')
      triggerMatches = weekday === trigger.config.weekday;
    if (triggerMatches && trigger.config.frequency === 'monthly')
      triggerMatches = Number(part('day')) === trigger.config.dayOfMonth;
    if (triggerMatches && trigger.config.frequency === 'once') {
      const localDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: trigger.config.timezone,
      }).format(now);
      triggerMatches = localDate === trigger.config.date;
    }
  }
  const failedConditions = input.conditions.filter(
    (condition) => !conditionMatches(condition, input.context),
  );
  return {
    matched: triggerMatches && failedConditions.length === 0,
    triggerMatches,
    failedConditions,
    wouldPrepare: triggerMatches && failedConditions.length === 0,
  };
}

export async function listAutomationLogs(
  db: Database,
  userId: string,
  automationId: string,
  limit = 50,
) {
  return db
    .select()
    .from(automationExecutionLogs)
    .where(
      and(
        eq(automationExecutionLogs.clerkUserId, userId),
        eq(automationExecutionLogs.automationId, automationId),
      ),
    )
    .orderBy(desc(automationExecutionLogs.createdAt))
    .limit(limit);
}

export async function listUserAutomationActivity(
  db: Database,
  userId: string,
  input: { after?: Date; limit?: number } = {},
) {
  const filters = [eq(automationExecutionLogs.clerkUserId, userId)];
  if (input.after) filters.push(gt(automationExecutionLogs.createdAt, input.after));
  return db
    .select({
      id: automationExecutionLogs.id,
      automationId: automationExecutionLogs.automationId,
      automationName: automations.name,
      status: automationExecutionLogs.status,
      summary: automationExecutionLogs.summary,
      details: automationExecutionLogs.details,
      errorCode: automationExecutionLogs.errorCode,
      createdAt: automationExecutionLogs.createdAt,
    })
    .from(automationExecutionLogs)
    .innerJoin(automations, eq(automationExecutionLogs.automationId, automations.id))
    .where(and(...filters))
    .orderBy(desc(automationExecutionLogs.createdAt))
    .limit(Math.min(input.limit ?? 50, 100));
}
