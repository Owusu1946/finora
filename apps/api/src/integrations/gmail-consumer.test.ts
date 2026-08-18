import { describe, expect, it } from 'vitest';

import {
  classifyInvoiceCandidate,
  extractAmountMinor,
  extractInvoiceNumber,
  hasInvoicePaymentEvidence,
} from './gmail-consumer';

describe('Gmail invoice classification', () => {
  it('extracts explicit invoice evidence', () => {
    expect(extractInvoiceNumber('Invoice INV-2048', '')).toBe('INV-2048');
    expect(extractAmountMinor('Invoice INV-2048', 'Amount due: GHS 1,250.50')).toBe(125_050);
    expect(extractAmountMinor('Invoice INV-2048', 'Total due: 1,250.50 GHS')).toBe(125_050);
    expect(hasInvoicePaymentEvidence('', 'Pay by bank transfer before the due date')).toBe(true);
  });

  it('does not manufacture invoice data from unrelated messages', () => {
    expect(extractInvoiceNumber('Your weekly account update', 'Balance: GHS 200.00')).toBeNull();
    expect(extractAmountMinor('Security notice', 'No financial amount included')).toBeNull();
    expect(hasInvoicePaymentEvidence('Newsletter', "Here are this week's product updates")).toBe(
      false,
    );
  });

  it('accepts invoice messages using the same predicate as persistence and counting', () => {
    expect(
      classifyInvoiceCandidate({
        id: 'message-1',
        snippet: 'Total due: 1,250.50 GHS',
        payload: {
          headers: [
            { name: 'From', value: 'Acme Billing <billing@acme.example>' },
            { name: 'Subject', value: 'Your August invoice' },
          ],
        },
      }),
    ).toMatchObject({ sender: 'Acme Billing', amountMinor: 125_050 });
  });

  it('rejects generic financial messages that are not invoices', () => {
    expect(
      classifyInvoiceCandidate({
        id: 'message-2',
        snippet: 'Your available balance is GHS 1,250.50',
        payload: {
          headers: [
            { name: 'From', value: 'Bank Alerts <alerts@bank.example>' },
            { name: 'Subject', value: 'Weekly account update' },
          ],
        },
      }),
    ).toBeNull();
  });
});
