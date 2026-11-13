import { beforeAll, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { ListState } from '@/components/shared/list-view/list-state';
import type { ArchiveTypeCount } from '@/types';
import {
  ARCHIVE_ALL_TYPES,
  ARCHIVE_DEFAULT_PAGE_SIZE,
  archiveChipCounts,
  archiveFilterParams,
  archiveListQuery,
  documentChips,
  documentFilters,
  readArchivePageSize,
  withArchivePageSize,
} from '../document-filters';

const state = (change: Partial<ListState> = {}): ListState => ({ q: '', chip: '', filters: {}, sort: null, columns: null, layout: 'list', page: 1, ...change });
const counts = (...entries: Array<[ArchiveTypeCount['type'], number]>): ArchiveTypeCount[] => entries.map(([type, count]) => ({ type, count }));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

// NF-99, AC-NF99-1 and AC-NF99-5: the chips are the types the server sends, and no other.
describe('documentChips (NF-99)', () => {
  it('DocumentChips_TheTypesOfTheServer_AreTheChipsAfterAll_AndNoOther', () => {
    const chips = documentChips(i18n.t, counts(['propertyDocument', 3], ['contract', 1]));

    expect(chips.map((chip) => chip.id)).toEqual([ARCHIVE_ALL_TYPES, 'propertyDocument', 'contract']);
    expect(chips.map((chip) => chip.label)).toEqual(['All', 'Property document', 'Contract']);
    expect(chips.every((chip) => chip.counted)).toBe(true);
    expect(chips.map((chip) => chip.id)).not.toContain('invoice');
  });

  it('DocumentChips_OneTypeOnly_HasNothingToChooseBetween', () => {
    expect(documentChips(i18n.t, counts(['propertyDocument', 3]))).toEqual([]);
    expect(documentChips(i18n.t, [])).toEqual([]);
  });

  it('DocumentChips_ATypeThePageDoesNotKnow_IsShownWithAPlainName', () => {
    const chips = documentChips(i18n.t, [
      { type: 'contract', count: 1 },
      { type: 'newKind' as ArchiveTypeCount['type'], count: 2 },
    ]);

    expect(chips[2]).toMatchObject({ id: 'newKind', label: 'Other document' });
  });
});

describe('archiveChipCounts (NF-99)', () => {
  it('ArchiveChipCounts_EachTypeHasItsCount_AndAllTheirSum', () => {
    expect(archiveChipCounts(counts(['propertyDocument', 3], ['contract', 1], ['touristTax', 0]))).toEqual({
      all: 4,
      propertyDocument: 3,
      contract: 1,
      touristTax: 0,
    });
  });

  it('ArchiveChipCounts_NothingFromTheServerYet_IsNoNumbers', () => {
    expect(archiveChipCounts(undefined)).toBeUndefined();
  });
});

describe('documentFilters (NF-99)', () => {
  it('DocumentFilters_OneProperty_OffersOnlyTheDays', () => {
    expect(documentFilters(i18n.t, [{ id: 'p1', name: 'Villa Rosa' }]).map((filter) => filter.id)).toEqual(['days']);
    expect(documentFilters(i18n.t, []).map((filter) => filter.id)).toEqual(['days']);
  });

  it('DocumentFilters_SeveralProperties_OfferTheDaysAndTheProperty', () => {
    const filters = documentFilters(i18n.t, [
      { id: 'p1', name: 'Villa Rosa' },
      { id: 'p2', name: 'Casa Mare' },
    ]);

    expect(filters.map((filter) => filter.id)).toEqual(['days', 'property']);
    expect(filters[1]).toMatchObject({
      type: 'select',
      allLabel: 'All properties',
      options: [
        { value: 'p1', label: 'Villa Rosa' },
        { value: 'p2', label: 'Casa Mare' },
      ],
    });
  });
});

describe('archiveFilterParams and archiveListQuery (NF-99)', () => {
  it('ArchiveFilterParams_DaysPropertyAndSearch_ComeFromTheState', () => {
    expect(archiveFilterParams(state({ q: '  APE ', filters: { days: '2026-01-01..2026-03-31', property: 'p1' } }))).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
      propertyId: 'p1',
      q: 'APE',
    });
  });

  it('ArchiveFilterParams_HalfARange_IsHalfARange', () => {
    expect(archiveFilterParams(state({ filters: { days: '2026-01-01..' } }))).toMatchObject({ from: '2026-01-01', to: undefined });
    expect(archiveFilterParams(state({ filters: { days: '..2026-03-31' } }))).toMatchObject({ from: undefined, to: '2026-03-31' });
  });

  it('ArchiveFilterParams_NothingChosen_IsNothing', () => {
    expect(archiveFilterParams(state())).toEqual({ from: undefined, to: undefined, propertyId: undefined, q: undefined });
  });

  it('ArchiveListQuery_AllChip_AsksEveryTypeTheCallerMayRead', () => {
    expect(archiveListQuery(state({ chip: ARCHIVE_ALL_TYPES, page: 3 }), 50)).toMatchObject({ types: undefined, page: 3, pageSize: 50 });
    // No chips at all (one type, or the types did not come): no type is asked either.
    expect(archiveListQuery(state({ chip: '' }), 25)).toMatchObject({ types: undefined });
  });

  it('ArchiveListQuery_ATypeChip_AsksThatTypeOnly', () => {
    expect(archiveListQuery(state({ chip: 'contract', q: 'rossi', filters: { property: 'p1' } }), 25)).toEqual({
      types: ['contract'],
      from: undefined,
      to: undefined,
      propertyId: 'p1',
      q: 'rossi',
      page: 1,
      pageSize: 25,
    });
  });
});

// NF-99: the page and the page size are in the address, so a reload and the Back button keep the place.
describe('page size in the address (NF-99)', () => {
  it.each([
    ['', ARCHIVE_DEFAULT_PAGE_SIZE],
    ['?pageSize=50', 50],
    ['?pageSize=100', 100],
    ['?pageSize=25', 25],
    ['?pageSize=7', ARCHIVE_DEFAULT_PAGE_SIZE],
    ['?pageSize=1000', ARCHIVE_DEFAULT_PAGE_SIZE],
    ['?pageSize=abc', ARCHIVE_DEFAULT_PAGE_SIZE],
  ])('ReadArchivePageSize_%s', (search, expected) => {
    expect(readArchivePageSize(new URLSearchParams(search))).toBe(expected);
  });

  it('WithArchivePageSize_AnotherSize_IsWrittenAndTheListStartsAgainFromItsFirstPage', () => {
    const next = withArchivePageSize(new URLSearchParams('q=ape&chip=contract&page=3'), 50);

    expect(next.get('pageSize')).toBe('50');
    expect(next.has('page')).toBe(false);
    expect(next.get('q')).toBe('ape');
    expect(next.get('chip')).toBe('contract');
  });

  it('WithArchivePageSize_TheDefaultSize_IsNotWritten', () => {
    expect(withArchivePageSize(new URLSearchParams('pageSize=50&page=2'), ARCHIVE_DEFAULT_PAGE_SIZE).toString()).toBe('');
  });
});
