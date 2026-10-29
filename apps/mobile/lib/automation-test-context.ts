import type { AutomationRecord, TestAutomationInput } from '@finora/shared';

type TestContext = TestAutomationInput['context'];

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function findZonedInstant(
  date: { year: number; month: number; day: number },
  time: string,
  timeZone: string,
) {
  const [hour, minute] = time.split(':').map(Number);
  const approximate = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  for (let offsetMinutes = -1_440; offsetMinutes <= 1_440; offsetMinutes += 1) {
    const candidate = new Date(approximate + offsetMinutes * 60_000);
    const parts = localParts(candidate, timeZone);
    if (
      parts.year === date.year &&
      parts.month === date.month &&
      parts.day === date.day &&
      parts.hour === hour &&
      parts.minute === minute
    ) {
      return candidate;
    }
  }
  return new Date(approximate);
}

function scheduleMatchNow(trigger: Extract<AutomationRecord['trigger'], { type: 'schedule' }>) {
  const config = trigger.config;
  if (config.frequency === 'once' && config.date) {
    const [year, month, day] = config.date.split('-').map(Number);
    return findZonedInstant({ year, month, day }, config.time, config.timezone);
  }

  const current = localParts(new Date(), config.timezone);
  const calendar = new Date(Date.UTC(current.year, current.month - 1, current.day));
  const matchesDate = (candidate: Date) => {
    const weekday = candidate.getUTCDay();
    if (config.frequency === 'weekdays') return weekday >= 1 && weekday <= 5;
    if (config.frequency === 'weekly') return weekday === config.weekday;
    if (config.frequency === 'monthly') return candidate.getUTCDate() === config.dayOfMonth;
    return true;
  };
  for (let days = 0; days <= 370; days += 1) {
    const candidate = new Date(calendar.getTime() + days * 86_400_000);
    if (!matchesDate(candidate)) continue;
    return findZonedInstant(
      {
        year: candidate.getUTCFullYear(),
        month: candidate.getUTCMonth() + 1,
        day: candidate.getUTCDate(),
      },
      config.time,
      config.timezone,
    );
  }
  return new Date();
}

function applyConditions(automation: AutomationRecord, context: TestContext) {
  for (const condition of automation.conditions) {
    if (condition.type === 'amount_max') {
      context.amount = Math.min(context.amount ?? condition.amount, condition.amount);
      context.currency = condition.currency;
    } else if (condition.type === 'amount_min') {
      context.amount = Math.max(context.amount ?? condition.amount, condition.amount);
      context.currency = condition.currency;
    } else if (condition.type === 'currency_is') {
      context.currency = condition.currency;
    } else if (condition.type === 'supplier_is') {
      context.supplierId = condition.supplierId;
    } else if (condition.type === 'sender_domain_is') {
      context.senderDomain = condition.domain;
    }
  }
  return context;
}

export function matchingAutomationContext(automation: AutomationRecord): TestContext {
  const context: TestContext = {};
  const trigger = automation.trigger;
  if (trigger.type === 'schedule') {
    context.now = scheduleMatchNow(trigger).toISOString();
  } else if (trigger.type === 'balance_threshold') {
    context.currency = trigger.config.currency;
    context.walletBalance =
      trigger.config.operator === 'below'
        ? Math.max(0, trigger.config.amount - 1)
        : trigger.config.amount + 1;
  } else if (trigger.type === 'gmail_invoice') {
    context.senderDomain = trigger.config.senderDomains[0] ?? 'example.com';
  } else if (trigger.type === 'invoice_due') {
    context.invoiceDueInDays = trigger.config.dueWithinDays;
  }
  return applyConditions(automation, context);
}

export function rejectingAutomationContext(automation: AutomationRecord): TestContext | null {
  const context = matchingAutomationContext(automation);
  const trigger = automation.trigger;
  if (trigger.type === 'schedule') {
    context.now = new Date(new Date(context.now!).getTime() + 60_000).toISOString();
  } else if (trigger.type === 'balance_threshold') {
    context.walletBalance = trigger.config.amount;
  } else if (trigger.type === 'gmail_invoice') {
    if (trigger.config.senderDomains.length === 0) return null;
    context.senderDomain = 'does-not-match.invalid';
  } else if (trigger.type === 'invoice_due') {
    context.invoiceDueInDays = trigger.config.dueWithinDays + 1;
  }
  return context;
}

export function triggerSupportLabel(automation: AutomationRecord) {
  if (automation.trigger.type === 'gmail_invoice')
    return 'Dry-run only: Gmail ingestion is not connected yet.';
  if (automation.trigger.type === 'invoice_due')
    return 'Dry-run only: invoice-due scanning is not connected yet.';
  return 'Live dispatch is available for this trigger.';
}
