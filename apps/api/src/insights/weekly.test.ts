import { describe, expect, it } from 'vitest';

import { isWeeklyInsightMinute, weeklyInsightMessage } from './weekly';

describe('weekly insights', () => {
  it('runs on Monday at 08:00 UTC only', () => {
    expect(isWeeklyInsightMinute(new Date('2026-11-02T08:00:00.000Z'))).toBe(true);
    expect(isWeeklyInsightMinute(new Date('2026-11-02T08:01:00.000Z'))).toBe(false);
    expect(isWeeklyInsightMinute(new Date('2026-11-03T08:00:00.000Z'))).toBe(false);
  });

  it('says nothing when the week only has totals', () => {
    expect(
      weeklyInsightMessage('m', ['$100 out; the most went to Bills ($100, 100%).']),
    ).toBeNull();
  });

  it('lists the highlights as bullets', () => {
    const message = weeklyInsightMessage('m', ['$100 out.', 'Possible double payment: Acme.']);
    expect(message?.parts[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('- Possible double payment: Acme.'),
    });
  });
});
