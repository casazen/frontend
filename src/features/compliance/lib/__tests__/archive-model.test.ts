import { describe, expect, it } from 'vitest';
import type { CoverageReport, CoverageRow } from '@/types';
import { archiveWindow, formatPeriod, isMonthKind, isTaxKind, listedMonths, listedYears, proofKindOfRow, readArchiveAddress, rowMatchesKind, rowsOf, summarizeCoverage } from '../archive-model';

const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

const params = (query: string) => new URLSearchParams(query);

describe('readArchiveAddress (the links of the cockpit)', () => {
  it('readArchiveAddress_LinkOfAPeriodItem_PreselectsKindPropertyAndMonth', () => {
    // The address `complianceActionRoute` builds for `UploadIstatProof` (E03/F03/US01/T01).
    const address = readArchiveAddress(params(`kind=IstatProof&property=${PROPERTY_ID}&period=2026-08`), true);

    expect(address).toMatchObject({ kind: 'IstatProof', propertyId: PROPERTY_ID, period: '2026-08', page: 1 });
    expect(address.day).toBeUndefined();
  });

  it('readArchiveAddress_LinkOfTheTouristTaxDeclaration_IsAKindAndAProperty', () => {
    const address = readArchiveAddress(params(`property=${PROPERTY_ID}&kind=TouristTaxDeclaration`), true);

    expect(address).toMatchObject({ kind: 'TouristTaxDeclaration', propertyId: PROPERTY_ID });
    expect(address.period).toBeUndefined();
  });

  it.each([
    ['a kind that is not one of the four', 'kind=Everything'],
    ['a property that is not an id', 'property=../../secrets'],
    ['a month that is not a month', 'period=2026-13'],
    ['a month of a year the backend does not know', 'period=1999-05'],
    ['a text instead of a month', 'period=agosto'],
    ['a day that does not exist', 'day=2026-02-30'],
  ])('readArchiveAddress_%s_IsLeftOutNeverGuessed', (_what, query) => {
    const address = readArchiveAddress(params(query), true);

    expect(address.kind).toBeUndefined();
    expect(address.propertyId).toBeUndefined();
    expect(address.period).toBeUndefined();
    expect(address.day).toBeUndefined();
  });

  it('readArchiveAddress_DayAndPeriod_TheDayIsTheOnlyOne', () => {
    const address = readArchiveAddress(params('day=2026-08-15&period=2026-08'), true);

    expect(address.day).toBe('2026-08-15');
    expect(address.period).toBeUndefined();
  });

  it('readArchiveAddress_AYear_IsAPeriodToo', () => {
    expect(readArchiveAddress(params('period=2025'), true).period).toBe('2025');
  });

  it.each([
    ['', true, 'summary'],
    ['tab=proofs', true, 'proofs'],
    ['tab=summary', true, 'summary'],
    // A link of the cockpit has no tab: it opens the summary narrowed to what the item is about, where the missing row has its button.
    [`kind=IstatProof&property=${PROPERTY_ID}&period=2026-08`, true, 'summary'],
    // Without the traffic light there is no summary: every address is the archive of the proofs.
    ['', false, 'proofs'],
    ['tab=summary', false, 'proofs'],
  ] as const)('readArchiveAddress_Query%s_WithSummary%s_Opens%s', (query, hasSummary, tab) => {
    expect(readArchiveAddress(params(query), hasSummary).tab).toBe(tab);
  });

  it.each([
    ['page=3', 3],
    ['page=0', 1],
    ['page=-2', 1],
    ['page=1.5', 1],
    ['page=many', 1],
    ['', 1],
  ])('readArchiveAddress_%s_IsPage%i', (query, page) => {
    expect(readArchiveAddress(params(query), false).page).toBe(page);
  });
});

describe('archiveWindow', () => {
  it('archiveWindow_Month_IsItsFirstAndLastDay', () => {
    expect(archiveWindow({ period: '2026-08' }, '2026-11-13')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(archiveWindow({ period: '2028-02' }, '2026-11-13')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('archiveWindow_Year_IsTheWholeYear', () => {
    expect(archiveWindow({ period: '2025' }, '2026-11-13')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('archiveWindow_Day_IsThatDayOnly', () => {
    expect(archiveWindow({ day: '2026-08-15', period: undefined }, '2026-11-13')).toEqual({ from: '2026-08-15', to: '2026-08-15' });
  });

  it('archiveWindow_Nothing_IsTheThreeWholeMonthsBeforeAndTheCurrentOne', () => {
    expect(archiveWindow({}, '2026-11-13')).toEqual({ from: '2026-08-01', to: '2026-11-30' });
    // January: the ISTAT of December is due, so December is in the window.
    expect(archiveWindow({}, '2027-01-05')).toEqual({ from: '2026-10-01', to: '2027-01-31' });
  });
});

describe('periods of the list', () => {
  it('listedMonths_Today_IsTwelveMonthsNewestFirst', () => {
    const months = listedMonths('2026-11-13');

    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-11');
    expect(months[11]).toBe('2025-12');
  });

  // A proof is kept five years from its upload: the years offered reach back as far as one that can still be there, so none is out of the reach of the page.
  it('listedYears_Today_IsThisYearAndTheFiveBeforeAsFarBackAsAProofIsKept', () => {
    expect(listedYears('2026-11-13')).toEqual(['2026', '2025', '2024', '2023', '2022', '2021']);
  });

  it('listedYears_NearTheFirstSupportedYear_StopsThere', () => {
    expect(listedYears('2003-05-01')).toEqual(['2003', '2002', '2001', '2000']);
  });

  it('formatPeriod_MonthYearAndDay_ReadsInTheLanguageOfThePage', () => {
    expect(formatPeriod('2026-08', 'it')).toBe('agosto 2026');
    expect(formatPeriod('2026-08', 'en')).toBe('August 2026');
    expect(formatPeriod('2026', 'it')).toBe('2026');
    expect(formatPeriod('2026-08-15', 'it')).toBe('15 agosto 2026');
  });
});

describe('kinds', () => {
  it('proofKindOfRow_EachObligation_HasTheProofItIsAnsweredWith', () => {
    expect(proofKindOfRow('Alloggiati')).toBe('AlloggiatiReceipt');
    expect(proofKindOfRow('Istat')).toBe('IstatProof');
    expect(proofKindOfRow('TouristTax')).toBe('TouristTaxDeclaration');
  });

  it('rowMatchesKind_TouristTax_IsBothItsDeclarationAndItsPayment', () => {
    expect(rowMatchesKind({ kind: 'TouristTax' }, 'TouristTaxDeclaration')).toBe(true);
    expect(rowMatchesKind({ kind: 'TouristTax' }, 'TouristTaxPayment')).toBe(true);
    expect(rowMatchesKind({ kind: 'TouristTax' }, 'IstatProof')).toBe(false);
    expect(rowMatchesKind({ kind: 'Istat' }, 'IstatProof')).toBe(true);
    expect(rowMatchesKind({ kind: 'Alloggiati' }, undefined)).toBe(true);
  });

  it('isTaxKind_AndIsMonthKind_SaySomethingAboutMoneyAndAboutAMonth', () => {
    expect(isTaxKind('TouristTaxDeclaration')).toBe(true);
    expect(isTaxKind('TouristTaxPayment')).toBe(true);
    expect(isTaxKind('IstatProof')).toBe(false);
    expect(isMonthKind('AlloggiatiReceipt')).toBe(false);
    expect(isMonthKind('IstatProof')).toBe(true);
  });
});

const row = (evidenceClass: string, change: Partial<CoverageRow> = {}): CoverageRow =>
  ({
    kind: 'Alloggiati',
    propertyId: PROPERTY_ID,
    propertyName: 'Casa Como',
    bookingId: 'b1',
    bookingCode: 'AB123-CD456',
    day: '2026-08-15',
    period: null,
    evidenceClass,
    evidenceSource: null,
    proofAt: null,
    deadlineAt: null,
    action: null,
    reason: 'receipt_archived',
    handoffTopic: null,
    ...change,
  }) as CoverageRow;

const report = (change: Partial<CoverageReport>): CoverageReport => ({
  from: '2026-08-01',
  to: '2026-08-31',
  propertyId: null,
  generatedAt: '2026-11-13T10:00:00Z',
  complete: false,
  officialProof: 0,
  externalVerificationRequired: 0,
  missing: 0,
  notApplicable: 0,
  rows: [],
  ...change,
});

// AC 8: the summary never displays «all compliant» when the API reports ExternalVerificationRequired or Missing; green is never worked out from no data.
describe('summarizeCoverage', () => {
  it('summarizeCoverage_EverythingProvenAndTheApiSaysComplete_IsTheOnlyGreen', () => {
    const summary = summarizeCoverage(report({ complete: true, officialProof: 2, rows: [row('OfficialProof'), row('OfficialProof')] }));

    expect(summary).toMatchObject({ tone: 'success', key: 'allProven', proven: 2 });
  });

  it('summarizeCoverage_SomethingMissing_IsRedWhateverTheRest', () => {
    const summary = summarizeCoverage(report({ complete: true, officialProof: 5, missing: 1, rows: [row('Missing'), row('OfficialProof')] }));

    expect(summary).toMatchObject({ tone: 'danger', key: 'missing', missing: 1 });
  });

  it('summarizeCoverage_OnlyTheChannelManagerCanTell_IsNeverGreenAndIsNotAnInferredResult', () => {
    const summary = summarizeCoverage(report({ complete: true, officialProof: 3, externalVerificationRequired: 2, rows: [row('ExternalVerificationRequired'), row('ExternalVerificationRequired')] }));

    expect(summary).toMatchObject({ tone: 'warning', key: 'toVerify', toVerify: 2 });
  });

  it('summarizeCoverage_TheApiCountsMoreThanTheRows_TheCountsOfTheApiAreBelieved', () => {
    expect(summarizeCoverage(report({ complete: true, officialProof: 1, missing: 2, rows: [row('OfficialProof')] })).tone).toBe('danger');
    expect(summarizeCoverage(report({ complete: true, officialProof: 1, externalVerificationRequired: 1, rows: [row('OfficialProof')] })).tone).toBe('warning');
  });

  it('summarizeCoverage_NoCountsAndNotComplete_IsToVerifyNeverGreen', () => {
    const summary = summarizeCoverage(report({ complete: false, rows: [] }));

    expect(summary).toMatchObject({ tone: 'warning', key: 'unknown' });
  });

  it('summarizeCoverage_CompleteWithNothingProvenAndNothingOwed_SaysNothingIsOwedNotThatItIsAllProven', () => {
    const summary = summarizeCoverage(report({ complete: true, notApplicable: 1, rows: [row('NotApplicable', { reason: 'no_show' })] }));

    expect(summary).toMatchObject({ tone: 'neutral', key: 'nothingOwed' });
  });

  it('summarizeCoverage_CompleteButEmpty_IsNotGreenEither', () => {
    // «Complete» with no rows at all and no proof is an absence of data: not a green light.
    expect(summarizeCoverage(report({ complete: true, rows: [] })).tone).toBe('neutral');
    expect(summarizeCoverage(report({ complete: true, rows: [] })).key).toBe('nothingOwed');
  });

  it('rowsOf_AnEvidenceClassThisVersionDoesNotKnow_IsARowToVerifyNeverAProof', () => {
    const rows = [row('Inferred'), row('OfficialProof')];

    expect(rowsOf(rows, 'ExternalVerificationRequired')).toHaveLength(1);
    expect(rowsOf(rows, 'OfficialProof')).toHaveLength(1);
    expect(summarizeCoverage(report({ complete: true, officialProof: 1, rows })).tone).toBe('warning');
  });
});
