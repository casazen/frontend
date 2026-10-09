import { describe, expect, it } from 'vitest';
import { chipCount, filterListRows, matchesSearch, normalizeSearchText, resolveOptions, sortListRows, visibleColumns } from '../list-data';
import { readListState } from '../list-state';
import { STAYS, stayList } from './list-fixtures';

const list = stayList();
const stateOf = (query: string) => readListState(list, new URLSearchParams(query));
const idsOf = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe('search', () => {
  it('ignores capitals and accents on both sides', () => {
    expect(normalizeSearchText('Città ÀÈÌÒÙ')).toBe('citta aeiou');
    expect(matchesSearch('Zoë Müller', 'zoe muller')).toBe(true);
    expect(matchesSearch('Zoe Muller', 'ZOË')).toBe(true);
  });

  it('wants every word, in any order, as part of a word', () => {
    expect(matchesSearch('Mario Rossi', 'ross mar')).toBe(true);
    expect(matchesSearch('Mario Rossi', 'mario bianchi')).toBe(false);
  });

  it('matches everything when there are no words', () => {
    expect(matchesSearch('anything', '')).toBe(true);
    expect(matchesSearch('anything', '   ')).toBe(true);
  });
});

describe('filterListRows', () => {
  it('applies the quick filter of the state', () => {
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=pending')))).toEqual(['s1']);
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=inProgress')))).toEqual(['s3']);
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all')))).toHaveLength(6);
  });

  it('can leave the quick filter out, as the counters of the chips need', () => {
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=done&f_property=trullo'), { ignoreChip: true }))).toEqual(['s2', 's3', 's6']);
  });

  it('searches the text the list gives, not only the name', () => {
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all&q=zoe+example')))).toEqual(['s3']);
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all&q=nobody')))).toEqual([]);
  });

  it('falls back to the label of the row when the list names no text to search', () => {
    const plain = stayList({ extra: { search: { label: 'Search', placeholder: 'Search' } } });
    const state = readListState(plain, new URLSearchParams('chip=all&q=ross'));

    expect(idsOf(filterListRows(plain, STAYS, state))).toEqual(['s1']);
  });

  it('applies a select filter, a multiple one and a range of dates', () => {
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all&f_property=trullo')))).toEqual(['s2', 's3', 's6']);
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all&f_channel=airbnb,booking')))).toEqual(['s2', 's3', 's5']);
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all&f_arrival=2026-10-07..2026-10-12')))).toEqual(['s1', 's2', 's3']);
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all&f_arrival=2026-11-01..')))).toEqual(['s6']);
  });

  it('puts the search and the filters together', () => {
    expect(idsOf(filterListRows(list, STAYS, stateOf('chip=all&q=example&f_property=casa-bianca&f_channel=direct')))).toEqual(['s1', 's4']);
  });

  it('can count another set of filters than the one of the state (the draft in the panel)', () => {
    const state = stateOf('chip=all&f_property=trullo');

    expect(filterListRows(list, STAYS, state, { filters: {} })).toHaveLength(6);
    expect(filterListRows(list, STAYS, state, { filters: { channel: 'direct' } })).toHaveLength(3);
  });

  it('lets a filter without a test pass everything (the server does the filtering)', () => {
    const noTest = stayList({ extra: { filters: [{ id: 'property', label: 'Property', type: 'select', options: [] }] } });
    const state = readListState(noTest, new URLSearchParams('chip=all&f_property=trullo'));

    expect(filterListRows(noTest, STAYS, state)).toHaveLength(6);
  });
});

describe('sortListRows', () => {
  it('sorts words in the language of the person, numbers as numbers, and can reverse', () => {
    expect(idsOf(sortListRows(list, STAYS, { id: 'guest', direction: 'asc' }, 'it'))).toEqual(['s5', 's2', 's6', 's4', 's1', 's3']);
    expect(idsOf(sortListRows(list, STAYS, { id: 'total', direction: 'desc' }, 'it'))).toEqual(['s4', 's3', 's1', 's2', 's6', 's5']);
    expect(idsOf(sortListRows(list, STAYS, { id: 'total', direction: 'asc' }, 'it'))).toEqual(['s5', 's6', 's2', 's1', 's3', 's4']);
  });

  it('puts what has no value last, in either direction', () => {
    const rows = [
      { ...STAYS[0], id: 'a', total: 10 },
      { ...STAYS[0], id: 'b', total: undefined as unknown as number },
      { ...STAYS[0], id: 'c', total: 5 },
    ];

    expect(idsOf(sortListRows(list, rows, { id: 'total', direction: 'asc' }, 'it'))).toEqual(['c', 'a', 'b']);
    expect(idsOf(sortListRows(list, rows, { id: 'total', direction: 'desc' }, 'it'))).toEqual(['a', 'c', 'b']);
  });

  it('keeps the order it was given without a sort, or for a column that cannot be sorted, and never touches the rows it was given', () => {
    const given = [...STAYS];

    expect(idsOf(sortListRows(list, given, null, 'it'))).toEqual(idsOf(STAYS));
    expect(idsOf(sortListRows(list, given, { id: 'channel', direction: 'asc' }, 'it'))).toEqual(idsOf(STAYS));
    sortListRows(list, given, { id: 'guest', direction: 'asc' }, 'it');
    expect(given).toEqual(STAYS);
  });
});

describe('visibleColumns', () => {
  it('shows the default columns, or the ones chosen, and always the ones that cannot be hidden', () => {
    expect(visibleColumns(list, null).map((column) => column.id)).toEqual(['guest', 'dates', 'channel', 'status', 'total']);
    expect(visibleColumns(list, ['email', 'code']).map((column) => column.id)).toEqual(['guest', 'email', 'code']);
  });
});

describe('chipCount', () => {
  it('counts only for the chips that need attention, with the rows that pass the test', () => {
    const [all, pending] = list.chips!;

    expect(chipCount(all, STAYS)).toBe(0);
    expect(chipCount(pending, STAYS)).toBe(1);
    expect(chipCount({ ...pending, urgent: false }, STAYS)).toBe(0);
  });

  it('counts another way when the chip says so, and counts every row when there is no test', () => {
    expect(chipCount({ id: 'x', label: 'X', urgent: true, count: () => 7 }, STAYS)).toBe(7);
    expect(chipCount({ id: 'y', label: 'Y', urgent: true }, STAYS)).toBe(6);
  });
});

describe('resolveOptions', () => {
  it('gives a fixed list as it is and asks a function for the options of the rows', () => {
    const fixed = [{ value: 'a', label: 'A' }];

    expect(resolveOptions(fixed, STAYS)).toBe(fixed);
    expect(resolveOptions((rows) => rows.slice(0, 2).map((row) => ({ value: row.id, label: row.id })), STAYS)).toEqual([
      { value: 's1', label: 's1' },
      { value: 's2', label: 's2' },
    ]);
  });
});
