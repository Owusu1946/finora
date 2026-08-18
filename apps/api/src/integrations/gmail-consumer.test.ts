import { describe, expect, it } from 'vitest';

import {
  extractAmountMinor,
  extractInvoiceNumber,
  hasInvoicePaymentEvidence,
} from './gmail-consumer';

describe('Gmail invoice classification', () => {
  it('extracts explicit invoice evidence', () => {
    expect(extractInvoiceNumber('Invoice INV-2048', '')).toBe('INV-2048');
    expect(extractAmountMinor('Invoice INV-2048', 'Amount due: GHS 1,250.50')).toBe(125_050);
    expect(hasInvoicePaymentEvidence('', 'Pay by bank transfer before the due date')).toBe(true);
  });

  it('does not manufacture invoice data from unrelated messages', () => {
    expect(extractInvoiceNumber('Your weekly account update', 'Balance: GHS 200.00')).toBeNull();
    expect(extractAmountMinor('Security notice', 'No financial amount included')).toBeNull();
    expect(hasInvoicePaymentEvidence('Newsletter', "Here are this week's product updates")).toBe(false);
  });
});
