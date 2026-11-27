import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import {
  BULK_PAGE_SIZE,
  EMPTY_FILTER,
  IMPORT_COLUMNS,
  buildSelection,
  bulkReasonKey,
  importColumnKey,
  importErrorKey,
  importTemplateCsv,
  isAcceptedImportFile,
  pageOf,
} from '../onboarding-bulk';

describe('buildSelection, the selection of the bulk configuration never means «all» by accident (NF-105)', () => {
  it('BuildSelection_NothingChosen_IsNoSelection', () => {
    expect(buildSelection(null, EMPTY_FILTER)).toEqual({ selection: null, problem: null });
    // A filter typed while nothing is chosen does not choose anything.
    expect(buildSelection(null, { ...EMPTY_FILTER, comuni: '047017' }).selection).toBeNull();
  });

  it('BuildSelection_All_IsAskedForByNameAndCarriesNothingElse', () => {
    expect(buildSelection('all', { ...EMPTY_FILTER, comuni: '047017' })).toEqual({ selection: { kind: 'all' }, problem: null });
  });

  it('BuildSelection_FilterWithNoCriterion_IsNoSelectionAndNeverAll', () => {
    expect(buildSelection('filter', EMPTY_FILTER)).toEqual({ selection: null, problem: 'none' });
    expect(buildSelection('filter', { ...EMPTY_FILTER, comuni: ' , ; ' })).toEqual({ selection: null, problem: 'none' });
  });

  it('BuildSelection_FilterWithCriteria_NormalizesTheListsOnceEachAndSendsOnlyTheFilter', () => {
    const built = buildSelection('filter', { comuni: '047017, 047017\n099014', regions: 'lom; EMR', channels: 'Booking_XML', flow: 'Bookings', flowState: 'toComplete' });

    expect(built.problem).toBeNull();
    expect(built.selection).toEqual({
      kind: 'filter',
      filter: {
        comuneIstatCodes: ['047017', '099014'],
        regionCodes: ['LOM', 'EMR'],
        channelCodes: ['booking_xml'],
        flowState: { flow: 'Bookings', state: 'toComplete' },
      },
    });
    expect(built.selection).not.toHaveProperty('propertyIds');
  });

  it.each([
    ['comuni', { comuni: '4701' }],
    ['comuni', { comuni: '047017, abc' }],
    ['regions', { regions: 'L' }],
    ['regions', { regions: 'LOM1' }],
    ['channels', { channels: 'booking xml!' }],
    ['flowState', { flow: 'Bookings' as const }],
    ['flowState', { flowState: 'active' as const }],
  ])('BuildSelection_ACodeThatIsNotOne_%s_IsAProblemTheFieldSaysAndNoSelection', (problem, change) => {
    expect(buildSelection('filter', { ...EMPTY_FILTER, comuni: '047017', ...change })).toEqual({ selection: null, problem });
  });
});

describe('the file of the import, the template and the pages of a long result', () => {
  it('ImportTemplate_IsTheHeaderOfTheColumnsTheServerKnowsAndNothingElse', () => {
    const lines = importTemplateCsv().split('\r\n').filter(Boolean);

    expect(lines).toHaveLength(1);
    expect(lines[0].split(',')).toEqual([...IMPORT_COLUMNS]);
    expect(IMPORT_COLUMNS).toEqual(['propertyId', 'cinCode', 'comuneIstatCode', 'regionCode', 'alloggiatiRoomNumbers', 'lockCode']);
  });

  it('IsAcceptedImportFile_CsvAndXlsxNotEmptyAndAtMostTwoMegabytes_OnlyByNameAndSize', () => {
    const mb = 1024 * 1024;
    expect(isAcceptedImportFile({ name: 'a.csv', size: 10 })).toBe(true);
    expect(isAcceptedImportFile({ name: 'A.XLSX', size: 2 * mb })).toBe(true);
    expect(isAcceptedImportFile({ name: 'a.xlsx', size: 2 * mb + 1 })).toBe(false);
    expect(isAcceptedImportFile({ name: 'a.xls', size: 10 })).toBe(false);
    expect(isAcceptedImportFile({ name: 'a.xlsm', size: 10 })).toBe(false);
    expect(isAcceptedImportFile({ name: 'a.pdf', size: 10 })).toBe(false);
    expect(isAcceptedImportFile({ name: 'a.csv', size: 0 })).toBe(false);
  });

  it('PageOf_ALongList_IsDrawnFiftyAtATimeAndAPagePastTheEndIsTheLastOne', () => {
    const items = Array.from({ length: 120 }, (_, index) => index);

    expect(pageOf(items, 1)).toMatchObject({ page: 1, pages: 3 });
    expect(pageOf(items, 1).rows).toHaveLength(BULK_PAGE_SIZE);
    expect(pageOf(items, 3).rows).toHaveLength(20);
    expect(pageOf(items, 9)).toMatchObject({ page: 3 });
    expect(pageOf(items, 0)).toMatchObject({ page: 1 });
    expect(pageOf([], 1)).toEqual({ rows: [], page: 1, pages: 1 });
  });

  it('BulkTexts_EveryCodeOfARefusalAnErrorOrAColumn_HasATextInBothLanguagesAndAnUnknownOneIsNeverAKey', () => {
    const codes = {
      reasons: ['alloggiati_delegation_required', 'property_not_found', 'sender_casazen_not_available', 'sender_channel_manager_not_available', 'sender_declaration_not_applicable', 'sender_istat_mismatch', 'sender_not_applicable', 'sender_switch_confirmation_required'],
      errors: ['comune_unknown', 'duplicate_row', 'lock_code_invalid', 'property_ambiguous', 'property_not_found', 'region_mismatch', 'room_numbers_invalid'],
      columns: [...IMPORT_COLUMNS],
    };
    for (const language of ['it', 'en']) {
      for (const code of codes.reasons) expect(i18n.exists(bulkReasonKey(code), { lng: language }), `${code} ${language}`).toBe(true);
      for (const code of codes.errors) expect(i18n.exists(importErrorKey(code), { lng: language }), `${code} ${language}`).toBe(true);
      for (const code of codes.columns) expect(i18n.exists(importColumnKey(code), { lng: language }), `${code} ${language}`).toBe(true);
    }
    for (const unknown of ['brand_new_code', '', null, undefined, 'toString']) {
      expect(bulkReasonKey(unknown)).toBe('onboardingPlan.bulk.reasons.unknown');
      expect(importErrorKey(unknown)).toBe('onboardingPlan.bulk.import.errors.unknown');
      expect(importColumnKey(unknown)).toBe('onboardingPlan.bulk.import.columns.unknown');
    }
  });
});
