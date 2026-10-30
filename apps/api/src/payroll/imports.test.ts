import { describe, expect, it, vi } from 'vitest';

import { extractPayrollRows } from './attachment-extractor';
import { rowsFromDraft } from './imports';

describe('rowsFromDraft', () => {
  it('validates typed employees and flags what is missing', () => {
    const rows = rowsFromDraft({
      period: 'October 2026',
      rows: [
        {
          employeeName: 'Ama Boateng',
          amount: 2_000,
          currency: 'ghs',
          destination: '0241234567',
          destinationType: 'mobile_money',
          rail: 'MTN MoMo',
          role: null,
          reference: null,
        },
        {
          employeeName: 'Kofi Mensah',
          amount: null,
          currency: 'GHS',
          destination: null,
          destinationType: null,
          rail: null,
          role: 'Driver',
          reference: null,
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      rowId: 'row-1',
      currency: 'GHS',
      period: 'October 2026',
      issues: [],
      citations: [{ sourceName: 'Chat', location: 'Employee 1' }],
    });
    expect(rows[1]?.issues.map((issue) => issue.code)).toEqual([
      'amount_missing_or_invalid',
      'destination_missing',
    ]);
  });
});

describe('image extraction', () => {
  it('reads images through the model and validates the rows', async () => {
    const extractWithModel = vi.fn().mockResolvedValue([
      ['name', 'amount', 'currency', 'destination', 'destination type', 'rail'],
      ['Ama Boateng', 2_500, 'GHS', '0240000000', 'mobile_money', 'MTN'],
    ]);
    const rows = await extractPayrollRows({
      bytes: new ArrayBuffer(4),
      fileName: 'payroll.jpg',
      contentType: 'image/jpeg',
      extractWithModel,
    });
    expect(extractWithModel).toHaveBeenCalledWith({
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
    });
    expect(rows[0]).toMatchObject({
      employeeName: 'Ama Boateng',
      amount: 2_500,
      destinationType: 'mobile_money',
      issues: [],
      citations: [{ location: 'Image, row 2' }],
    });
  });

  it('explains when images cannot be read', async () => {
    await expect(
      extractPayrollRows({ bytes: new ArrayBuffer(4), fileName: 'x.png', contentType: 'image/png' }),
    ).rejects.toThrow('payroll_image_extraction_unavailable');
  });
});
