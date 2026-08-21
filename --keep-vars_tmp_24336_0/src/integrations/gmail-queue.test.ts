import { describe, expect, it } from 'vitest';

import { GmailSyncQueueMessageSchema } from './gmail-queue';

describe('GmailSyncQueueMessageSchema', () => {
  it('accepts the versioned Gmail sync message', () => {
    expect(
      GmailSyncQueueMessageSchema.parse({
        kind: 'gmail.initial-sync',
        integrationId: 'a3bb189e-8bf9-4d76-b0f2-e6f9f02d562e',
      }),
    ).toEqual({
      kind: 'gmail.initial-sync',
      integrationId: 'a3bb189e-8bf9-4d76-b0f2-e6f9f02d562e',
    });
  });

  it('rejects unknown queue messages', () => {
    expect(
      GmailSyncQueueMessageSchema.safeParse({ kind: 'gmail.delete', integrationId: 'invalid' })
        .success,
    ).toBe(false);
  });
});
