import type { AutomationRecord } from '@finora/shared';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../db/client';

const store = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  updateAutomation: vi.fn(),
}));
vi.mock('../db/automation-store', () => store);

const { automationsPrompt, createAutomationTools, isValidTimezone } = await import('./tools');

function record(overrides: Partial<AutomationRecord> = {}): AutomationRecord {
  return {
    id: '7f1c3f9e-2b7a-4c55-9a51-1f8e8c0d4a10',
    userId: 'user_1',
    name: 'Friday rent',
    trigger: {
      type: 'schedule',
      config: { frequency: 'weekly', time: '09:00', timezone: 'Africa/Accra', weekday: 5 },
    },
    conditions: [],
    action: { type: 'notify_chat', config: { message: 'Pay rent' } },
    status: 'active',
    cooldownSeconds: 0,
    version: 1,
    lastEvaluatedAt: null,
    lastTriggeredAt: null,
    lastRunStatus: null,
    totalRuns: 0,
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z',
    ...overrides,
  };
}

function setup() {
  const queue = { send: vi.fn().mockResolvedValue(undefined) };
  const tools = createAutomationTools({
    db: {} as Database,
    userId: 'user_1',
    queue,
    timezone: 'Africa/Lagos',
  });
  return { queue, tools };
}

async function run(
  tools: ReturnType<typeof setup>['tools'],
  name: keyof typeof tools,
  input: object,
) {
  const execute = tools[name].execute as unknown as (
    input: object,
    options: object,
  ) => Promise<Record<string, unknown>>;
  return execute(input, { toolCallId: 'call_1', messages: [] });
}

beforeEach(() => {
  store.listAutomations.mockReset();
  store.updateAutomation.mockReset();
});

describe('create_automation', () => {
  it('drafts without saving, using the user timezone for schedules', async () => {
    const { tools } = setup();
    const result = await run(tools, 'create_automation', {
      name: 'Monday sales check',
      trigger: {
        type: 'schedule',
        config: { frequency: 'weekly', time: '08:00', timezone: 'UTC', weekday: 1 },
      },
      action: { type: 'notify_chat', config: { message: 'Check last week’s sales' } },
    });
    expect(result).toMatchObject({
      status: 'draft',
      automation: { trigger: { config: { timezone: 'Africa/Lagos' } } },
      description: 'Every Monday at 08:00, Finora will remind you: "Check last week’s sales".',
    });
    expect(store.updateAutomation).not.toHaveBeenCalled();
  });
});

describe('manage_automation', () => {
  it('pauses an automation found by name', async () => {
    const { tools } = setup();
    store.listAutomations.mockResolvedValue([record()]);
    store.updateAutomation.mockResolvedValue(record({ status: 'paused' }));

    const result = await run(tools, 'manage_automation', {
      name: 'friday rent',
      operation: 'pause',
    });

    expect(store.updateAutomation).toHaveBeenCalledWith({}, 'user_1', {
      id: record().id,
      status: 'paused',
    });
    expect(result).toMatchObject({ ok: true, status: 'updated', automation: { status: 'paused' } });
  });

  it('runs now through the queue, skipping the trigger', async () => {
    const { queue, tools } = setup();
    store.listAutomations.mockResolvedValue([record()]);

    await run(tools, 'manage_automation', { name: 'Friday rent', operation: 'run_now' });

    expect(queue.send).toHaveBeenCalledWith(
      expect.objectContaining({ automationId: record().id, forced: true }),
    );
  });

  it('asks the user to confirm deletes instead of deleting', async () => {
    const { tools } = setup();
    store.listAutomations.mockResolvedValue([record()]);
    expect(
      await run(tools, 'manage_automation', { name: 'Friday rent', operation: 'delete' }),
    ).toMatchObject({ ok: true, status: 'confirm_delete' });
    expect(store.updateAutomation).not.toHaveBeenCalled();
  });

  it('reports ambiguous names with candidates', async () => {
    const { tools } = setup();
    store.listAutomations.mockResolvedValue([
      record({ id: 'a', name: 'Rent GHS' }),
      record({ id: 'b', name: 'Rent USD' }),
    ]);
    expect(await run(tools, 'manage_automation', { name: 'rent', operation: 'pause' })).toEqual({
      ok: false,
      errorCode: 'automation_ambiguous',
      candidates: [
        { id: 'a', name: 'Rent GHS' },
        { id: 'b', name: 'Rent USD' },
      ],
    });
  });

  it('will not run a paused automation', async () => {
    const { queue, tools } = setup();
    store.listAutomations.mockResolvedValue([record({ status: 'paused' })]);
    expect(
      await run(tools, 'manage_automation', { name: 'Friday rent', operation: 'run_now' }),
    ).toMatchObject({ ok: false, errorCode: 'automation_paused' });
    expect(queue.send).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('validates IANA timezones', () => {
    expect(isValidTimezone('Africa/Accra')).toBe(true);
    expect(isValidTimezone('Mars/Base')).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
  });

  it('tells the model the local date and time', () => {
    const prompt = automationsPrompt('Africa/Accra', new Date('2026-10-30T09:15:00Z'));
    expect(prompt).toMatch(
      /It is Friday,? 30 October 2026( at|,) 09:15 for the user \(Africa\/Accra\)\./,
    );
  });
});
