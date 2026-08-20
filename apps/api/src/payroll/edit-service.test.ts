import { describe, expect, it } from 'vitest';
import { PayrollImportRowSchema } from '@finora/shared';
import { applyProposedChanges, PayrollEditError } from './edit-service';

const row = PayrollImportRowSchema.parse({ rowId: 'row-1', employeeName: 'Ama Boateng', employeeId: 'E001', role: 'Designer', amount: 2500, currency: 'GHS', destinationType: 'Mobile Money', destination: '0240000000', rail: 'MTN', period: 'Sep-26', payDate: '2026-09-30', reference: 'PAY-001', confidence: 0.9, citations: [], issues: [] });

describe('applyProposedChanges', () => {
  it('applies multiple fields without changing the stable row id', () => {
    const result = applyProposedChanges([row], [{ rowId: 'row-1', operation: 'update', patch: { amount: 3000, rail: 'Telecel' } }]);
    expect(result.rows[0]).toMatchObject({ rowId: 'row-1', amount: 3000, rail: 'Telecel' });
    expect(result.changes[0]).toMatchObject({ before: { amount: 2500 }, after: { amount: 3000 } });
  });

  it('removes only explicitly selected rows', () => {
    expect(applyProposedChanges([row], [{ rowId: 'row-1', operation: 'delete' }]).rows).toEqual([]);
  });

  it('rejects duplicate changes for one row', () => {
    expect(() => applyProposedChanges([row], [{ rowId: 'row-1', operation: 'delete' }, { rowId: 'row-1', operation: 'delete' }])).toThrow(PayrollEditError);
  });
});
