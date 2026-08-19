import { describe, expect, it } from 'vitest';

import { classifyCalendarMoneyEvent } from './calendar-consumer';
import { CALENDAR_SCOPES, createCalendarAuthorizationUrl } from './google-calendar';
import { listGoogleCalendarEvents } from './google-calendar';

describe('Google Calendar OAuth', () => {
  it('uses PKCE, offline access, and the read-only Calendar scope', () => {
    const url = new URL(
      createCalendarAuthorizationUrl({
        clientId: 'client',
        redirectUri: 'https://api.example.com/oauth/google-calendar/callback',
        state: 'state',
        codeChallenge: 'challenge',
      }),
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([...CALENDAR_SCOPES]);
    expect(url.searchParams.get('scope')).not.toContain('calendar.events');
  });
});

describe('Google Calendar events', () => {
  it('reads a requested secondary calendar and includes same-day events', async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    try {
      await listGoogleCalendarEvents('token', 'team/calendar@example.com');
      const url = new URL(urls[0]!);
      expect(url.pathname).toContain('/team%2Fcalendar%40example.com/events');
      expect(new Date(url.searchParams.get('timeMin')!).getTime()).toBeLessThan(Date.now());
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('calendar money event classification', () => {
  it('keeps finance-related events and extracts bounded structured facts', () => {
    expect(
      classifyCalendarMoneyEvent({
        summary: 'AWS invoice due',
        description: 'Payment due: USD 86.40',
      }),
    ).toMatchObject({ kind: 'bill', amount: '86.40', currency: 'USD' });
  });

  it('ignores ordinary calendar events', () => {
    expect(classifyCalendarMoneyEvent({ summary: 'Product standup' })).toBeNull();
  });
});
