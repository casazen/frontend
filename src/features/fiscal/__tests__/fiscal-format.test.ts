import { describe, expect, it } from 'vitest';
import { currentFiscalYear, fiscalYears, periodOf } from '../fiscal-format';
import { taxProfileChanges } from '../tax-profile-changes';

describe('fiscal-format (CO-19)', () => {
  it('currentFiscalYear_LateEveningOf31DecemberUtc_IsTheRomeYear', () => {
    // 23:30 UTC of 31/12/2026 is already 1/1/2027 in Rome.
    expect(currentFiscalYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027);
  });

  it('currentFiscalYear_BeforeTheFirstFiscalYear_IsTheFirstFiscalYear', () => {
    expect(currentFiscalYear(new Date('2025-06-01T10:00:00Z'))).toBe(2026);
  });

  it('fiscalYears_TwoYearsIn_ListsNewestFirst', () => {
    expect(fiscalYears(new Date('2027-03-01T10:00:00Z'))).toEqual([2027, 2026]);
  });

  it('periodOf_Quarters_AreCalendarBoundsBothIncluded', () => {
    expect(periodOf(2026, 'year')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(periodOf(2026, 'q1')).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    expect(periodOf(2026, 'q4')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });
});

describe('taxProfileChanges (CO-19)', () => {
  const saved = { hasPartitaIva: true, partitaIvaNumber: '12345678901', fiscalCode: 'RSSMRA80A01H501U', fiscalDataRetentionUntil: null };

  it('taxProfileChanges_NothingChanged_IsEmpty', () => {
    expect(taxProfileChanges(saved, { hasPartitaIva: true, partitaIvaNumber: '123 456 789 01', fiscalCode: 'rssmra80a01h501u' })).toEqual({});
  });

  it('taxProfileChanges_VatRemoved_SendsOnlyTheFlag', () => {
    expect(taxProfileChanges(saved, { hasPartitaIva: false, partitaIvaNumber: '12345678901', fiscalCode: 'RSSMRA80A01H501U' })).toEqual({
      hasPartitaIva: false,
    });
  });

  it('taxProfileChanges_FiscalCodeEmptied_SendsAnEmptyStringToClearIt', () => {
    expect(taxProfileChanges(saved, { hasPartitaIva: true, partitaIvaNumber: '12345678901', fiscalCode: ' ' })).toEqual({
      fiscalCode: '',
    });
  });
});
