import { describe, expect, it } from 'vitest';
import { rentBreakdown } from '../rent-breakdown';

describe('rentBreakdown', () => {
  it('uses the current total and leaves the parts empty when the API sends no components', () => {
    expect(rentBreakdown({ amount: 1050, status: 'Scheduled' })).toEqual({
      hasComponents: false,
      rent: null,
      condominiumAdvance: null,
      condominiumSettlement: null,
      other: null,
      total: 1050,
      paid: 0,
      residual: 1050,
    });
  });

  it('reads the parts and keeps the stated total, paid amount and residual', () => {
    expect(
      rentBreakdown({
        amount: 1050,
        status: 'Scheduled',
        amountPaid: 400,
        residual: 650,
        components: [
          { kind: 'Rent', amount: 900 },
          { kind: 'CondominiumAdvance', amount: 150 },
          { kind: 'CondominiumSettlement', amount: 0 },
          { kind: 'Other', amount: 0 },
        ],
      }),
    ).toMatchObject({
      hasComponents: true,
      rent: 900,
      condominiumAdvance: 150,
      condominiumSettlement: 0,
      other: 0,
      total: 1050,
      paid: 400,
      residual: 650,
    });
  });

  it('counts an unknown kind with the other charges and treats a paid row as fully collected', () => {
    expect(
      rentBreakdown({
        amount: 120,
        status: 'Paid',
        components: [
          { kind: 'CondominiumSettlement', amount: 100 },
          { kind: 'SomethingElse', amount: 20 },
        ],
      }),
    ).toMatchObject({
      rent: 0,
      condominiumAdvance: 0,
      condominiumSettlement: 100,
      other: 20,
      total: 120,
      paid: 120,
      residual: 0,
    });
  });
});
