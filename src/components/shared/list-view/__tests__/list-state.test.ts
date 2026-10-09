import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  applyListState,
  clearedState,
  defaultChipId,
  defaultColumnIds,
  formatDateRange,
  isRefined,
  isSameView,
  listStateToParams,
  normalizeFilterValue,
  parseDateRange,
  parseMultiValue,
  parseSortValue,
  presetToState,
  readListState,
  viewQuery,
} from '../list-state';
import { stayList } from './list-fixtures';

const list = stayList();
const read = (query: string) => readListState(list, new URLSearchParams(query));
const write = (state: ReturnType<typeof read>) => listStateToParams(list, state).toString();

describe('readListState', () => {
  it('gives the default list for a plain address', () => {
    expect(read('')).toEqual({ q: '', chip: 'upcoming', filters: {}, sort: { id: 'dates', direction: 'asc' }, columns: null, layout: 'list', page: 1 });
  });

  it('reads the search, the quick filter, the filters, the order, the columns, the layout and the page', () => {
    const state = read('q=ross%20&chip=pending&f_property=trullo&f_channel=direct,airbnb&f_arrival=2026-10-01..2026-10-31&sort=total:desc&cols=guest,email&view=board&page=3');

    expect(state).toEqual({
      q: 'ross ',
      chip: 'pending',
      filters: { property: 'trullo', channel: 'direct,airbnb', arrival: '2026-10-01..2026-10-31' },
      sort: { id: 'total', direction: 'desc' },
      columns: ['guest', 'email'],
      layout: 'board',
      page: 3,
    });
  });

  it('keeps the spaces of the search as typed, so that the person can type a second word', () => {
    expect(read('q=mario+').q).toBe('mario ');
  });

  it('starts the board from the quick filter of the board, and the list from its own', () => {
    expect(read('view=board').chip).toBe('all');
    expect(read('').chip).toBe('upcoming');
    expect(defaultChipId(list, 'board')).toBe('all');
    expect(defaultChipId(list, 'list')).toBe('upcoming');
  });

  it('ignores what is not valid instead of failing', () => {
    expect(read('chip=nope').chip).toBe('upcoming');
    expect(read('f_property=castle').filters).toEqual({});
    expect(read('f_unknown=1').filters).toEqual({});
    expect(read('f_channel=castle').filters).toEqual({});
    expect(read('f_channel=castle,booking').filters).toEqual({ channel: 'booking' });
    expect(read('f_arrival=yesterday').filters).toEqual({});
    expect(read('f_arrival=2026-02-30..2026-03-01').filters).toEqual({});
    expect(read('f_arrival=2026-10-20..2026-10-01').filters).toEqual({});
    expect(read('f_arrival=..').filters).toEqual({});
    expect(read('sort=email:asc').sort).toEqual({ id: 'dates', direction: 'asc' });
    expect(read('sort=total:sideways').sort).toEqual({ id: 'dates', direction: 'asc' });
    expect(read('sort=total:desc:more').sort).toEqual({ id: 'dates', direction: 'asc' });
    expect(read('cols=nope,none').columns).toBeNull();
    expect(read('page=0').page).toBe(1);
    expect(read('page=-4').page).toBe(1);
    expect(read('page=abc').page).toBe(1);
    expect(read('page=2.5').page).toBe(2);
  });

  it('ignores the board layout of a list that has no board', () => {
    const plain = stayList({ withBoard: false });

    expect(readListState(plain, new URLSearchParams('view=board')).layout).toBe('list');
  });

  it('takes a sort without a direction as ascending', () => {
    expect(read('sort=total').sort).toEqual({ id: 'total', direction: 'asc' });
  });

  it('keeps the columns in the order of the list, adds the ones that cannot be hidden, and forgets that they are the defaults', () => {
    expect(read('cols=email,dates').columns).toEqual(['guest', 'dates', 'email']);
    expect(read('cols=guest,dates,channel,status,total').columns).toBeNull();
    expect(read('cols=dates,channel,status,total').columns).toBeNull();
  });

  it('cuts a very long search', () => {
    expect(read(`q=${'x'.repeat(500)}`).q).toHaveLength(200);
  });
});

describe('listStateToParams', () => {
  it('writes nothing for the default state, so the plain address is the plain list', () => {
    expect(write(read(''))).toBe('');
    expect(write(read('chip=upcoming&sort=dates:asc&page=1'))).toBe('');
  });

  it('writes the parts in a fixed order, whatever order the address had', () => {
    const state = read('page=2&view=board&cols=guest,email&sort=total:desc&f_channel=airbnb&chip=pending&q=anna');

    expect(write(state)).toBe('q=anna&chip=pending&f_channel=airbnb&sort=total%3Adesc&cols=guest%2Cemail&view=board&page=2');
  });

  it('is stable: what it writes reads back as the same state, and writes the same again', () => {
    for (const query of [
      'q=mario&chip=all&f_property=trullo&sort=guest:desc',
      'view=board&f_channel=booking,direct&f_arrival=..2026-10-31&cols=email',
      'page=7',
    ]) {
      const state = read(query);
      const written = write(state);

      expect(read(written)).toEqual(state);
      expect(write(read(written))).toBe(written);
    }
  });

  it('does not write the chip when it is the default of the layout the list is in', () => {
    expect(write(read('view=board'))).toBe('view=board');
    expect(write(read('view=board&chip=pending'))).toBe('chip=pending&view=board');
    expect(write(read('chip=all'))).toBe('chip=all');
  });
});

describe('applyListState', () => {
  it('replaces the parameters of the list and keeps the others where they are', () => {
    const current = new URLSearchParams('propertyId=p1&q=old&f_property=trullo&tab=x&page=4');
    const next = applyListState(list, current, { ...read(''), q: 'new', filters: {}, page: 1 });

    expect(next.toString()).toBe('propertyId=p1&tab=x&q=new');
  });

  it('does not touch the address it was given', () => {
    const current = new URLSearchParams('q=old');
    applyListState(list, current, { ...read(''), q: 'new' });

    expect(current.toString()).toBe('q=old');
  });
});

describe('views', () => {
  it('builds the state of a view that comes with the list', () => {
    const state = presetToState(list, { chip: 'all', filters: { arrival: '2026-10-07..2026-10-14' }, sort: 'total:desc', columns: ['email'], layout: 'board' });

    expect(state).toMatchObject({ chip: 'all', filters: { arrival: '2026-10-07..2026-10-14' }, sort: { id: 'total', direction: 'desc' }, columns: ['guest', 'email'], layout: 'board' });
  });

  it('drops from a view what is not valid, like an address would', () => {
    expect(presetToState(list, { chip: 'nope', filters: { property: 'castle' }, sort: 'email:asc' })).toEqual(read(''));
  });

  it('keeps of a view everything but the page, and tells two views apart by what they hold', () => {
    const a = read('chip=all&f_property=trullo&page=3');
    const b = read('chip=all&f_property=trullo');

    expect(viewQuery(list, a)).toBe('chip=all&f_property=trullo');
    expect(isSameView(list, a, b)).toBe(true);
    expect(isSameView(list, a, read('chip=all'))).toBe(false);
  });
});

describe('what narrows the list', () => {
  it('counts the filters that are on', () => {
    expect(activeFilterCount(read(''))).toBe(0);
    expect(activeFilterCount(read('f_property=trullo&f_channel=direct'))).toBe(2);
  });

  it('is refined by a search, a filter, or a quick filter other than the first one', () => {
    expect(isRefined(list, read('chip=all'))).toBe(false);
    expect(isRefined(list, read('chip=all&q=%20%20'))).toBe(false);
    expect(isRefined(list, read('chip=all&q=anna'))).toBe(true);
    expect(isRefined(list, read('chip=all&f_property=trullo'))).toBe(true);
    // The list starts from "Upcoming", which is already narrower than "All".
    expect(isRefined(list, read(''))).toBe(true);
  });

  it('clears the search, the filters and the quick filter, and keeps the order, the columns and the layout', () => {
    const cleared = clearedState(list, read('q=anna&chip=pending&f_property=trullo&sort=total:desc&cols=email&view=board&page=2'));

    expect(cleared).toMatchObject({ q: '', chip: 'all', filters: {}, sort: { id: 'total', direction: 'desc' }, columns: ['guest', 'email'], layout: 'board', page: 1 });
  });
});

describe('values', () => {
  it('reads and writes a range of dates, either end optional', () => {
    expect(parseDateRange('2026-10-01..2026-10-31')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(parseDateRange('..2026-10-31')).toEqual({ to: '2026-10-31' });
    expect(parseDateRange('2026-10-01..')).toEqual({ from: '2026-10-01' });
    expect(parseDateRange('nonsense')).toEqual({});
    expect(formatDateRange({ from: '2026-10-01' })).toBe('2026-10-01..');
  });

  it('reads a list of values', () => {
    expect(parseMultiValue('a, b,,c')).toEqual(['a', 'b', 'c']);
  });

  it('parses a sort', () => {
    expect(parseSortValue(list, 'total:desc')).toEqual({ id: 'total', direction: 'desc' });
    expect(parseSortValue(list, 'channel:asc')).toBeNull();
    expect(parseSortValue(list, undefined)).toBeNull();
  });

  it('tells which filter values are valid, using the options only when they are a fixed list', () => {
    const [property, channel, arrival] = list.filters!;

    expect(normalizeFilterValue(property, ' trullo ')).toBe('trullo');
    expect(normalizeFilterValue(property, 'castle')).toBeNull();
    expect(normalizeFilterValue(channel, 'booking,direct,booking')).toBe('direct,booking');
    expect(normalizeFilterValue(arrival, '2026-10-01..')).toBe('2026-10-01..');
    expect(normalizeFilterValue(arrival, '')).toBeNull();

    const drawnFromRows = { id: 'country', label: 'Country', type: 'select' as const, options: () => [] };
    expect(normalizeFilterValue(drawnFromRows, 'IT')).toBe('IT');
  });

  it('names the default columns', () => {
    expect(defaultColumnIds(list)).toEqual(['guest', 'dates', 'channel', 'status', 'total']);
  });
});
