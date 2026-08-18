import { describe, expect, it } from 'vitest';

import { parseInvoiceRange } from './invoices';

describe('parseInvoiceRange', () => {
  it('accepts an inclusive calendar range in the user timezone', () => {
    const result = parseInvoiceRange({
      startDate: '2026-08-01',
      endDate: '2026-08-18',
      timezone: 'Africa/Accra',
    });

    expect(result?.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(result?.endExclusive.toISOString()).toBe('2026-08-19T00:00:00.000Z');
  });

  it('rejects inverted and oversized ranges', () => {
    expect(
      parseInvoiceRange({ startDate: '2026-08-18', endDate: '2026-08-01', timezone: 'UTC' }),
    ).toBeNull();
    expect(
      parseInvoiceRange({ startDate: '2025-01-01', endDate: '2026-08-01', timezone: 'UTC' }),
    ).toBeNull();
  });

  it('rejects invalid timezones', () => {
    expect(
      parseInvoiceRange({ startDate: '2026-08-01', endDate: '2026-08-18', timezone: 'Mars/Base' }),
    ).toBeNull();
  });
});
