import { describe, expect, it } from 'vitest';

import { CHAT_AGENT_TOOL_NAMES, createChatAgentTools } from './tools';

describe('chat agent tools', () => {
  it('registers only the explicit Finora allowlist', () => {
    const tools = createChatAgentTools();

    expect(Object.keys(tools)).toEqual(CHAT_AGENT_TOOL_NAMES);
    expect(Object.keys(tools)).not.toContain('bash');
    expect(Object.keys(tools)).not.toContain('web_search');
    expect(Object.keys(tools)).not.toContain('image_generation');
    expect(Object.keys(tools).some((name) => name.startsWith('execute_'))).toBe(false);
  });

  it('keeps every registered tool server-executed', () => {
    const tools = createChatAgentTools();

    for (const value of Object.values(tools)) {
      expect(value.execute).toBeTypeOf('function');
    }
  });

  it('executes API-backed tools through the Finora platform routes', async () => {
    const tools = createChatAgentTools();
    const result = await tools.get_balances.execute(
      {},
      { toolCallId: 'call_test', messages: [], context: undefined },
    );

    expect('wallets' in result).toBe(true);
    if ('wallets' in result) {
      expect(result.wallets).toHaveLength(3);
      expect(result.wallets[0]).toMatchObject({ id: 'w_usd', currency: 'USD' });
    }
  });
});
