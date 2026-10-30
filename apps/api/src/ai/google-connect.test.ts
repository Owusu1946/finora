import { describe, expect, it, vi } from 'vitest';

import { createChatAgentTools } from './tools';

async function run(tools: ReturnType<typeof createChatAgentTools>, name: string, input: object) {
  const execute = tools[name as keyof typeof tools].execute as unknown as (
    input: object,
    options: object,
  ) => Promise<Record<string, unknown>>;
  return execute(input, { toolCallId: 'call_1', messages: [] });
}

describe('Google tools without a connection', () => {
  it('offers a Gmail Connect card when Gmail is not connected', async () => {
    const tools = createChatAgentTools({
      status: vi.fn().mockResolvedValue({ connected: false, status: 'disconnected' }),
      search: vi.fn().mockRejectedValue(new Error('gmail_not_connected')),
      message: vi.fn(),
    });

    expect(await run(tools, 'search_gmail_messages', { keywords: 'invoice' })).toEqual({
      ok: false,
      errorCode: 'gmail_not_connected',
      connectOptions: [expect.objectContaining({ app: 'gmail', kind: 'google' })],
    });
    expect(await run(tools, 'get_gmail_status', {})).toMatchObject({
      connectOptions: [expect.objectContaining({ app: 'gmail' })],
    });
  });

  it('offers Drive and Calendar cards', async () => {
    const tools = createChatAgentTools(
      undefined,
      { status: vi.fn(), dues: vi.fn().mockResolvedValue({ connected: false, events: [] }) },
      {
        search: vi.fn().mockResolvedValue({ ok: false, errorCode: 'drive_not_connected' }),
        file: vi.fn(),
      },
    );

    expect(await run(tools, 'search_drive_files', { query: 'lease' })).toMatchObject({
      connectOptions: [expect.objectContaining({ app: 'googledrive' })],
    });
    expect(await run(tools, 'list_calendar_dues', { range: 'week' })).toMatchObject({
      connectOptions: [expect.objectContaining({ app: 'googlecalendar' })],
    });
  });

  it('leaves connected results and other errors alone', async () => {
    const tools = createChatAgentTools(undefined, undefined, {
      search: vi.fn().mockResolvedValue({ ok: false, errorCode: 'drive_not_configured' }),
      file: vi.fn(),
    });

    expect(await run(tools, 'search_drive_files', { query: 'lease' })).toEqual({
      ok: false,
      errorCode: 'drive_not_configured',
    });
  });
});
