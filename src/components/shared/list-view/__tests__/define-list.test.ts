import { describe, expect, it } from 'vitest';
import { defineList } from '../define-list';
import { LIST_MAX_DEFAULT_COLUMNS, type ListColumn, type ListDefinition } from '../list-types';
import { stayList, type Stay } from './list-fixtures';

type Row = { id: string };

function column(id: string, extra: Partial<ListColumn<Row>> = {}): ListColumn<Row> {
  return { id, label: id, render: () => id, ...extra };
}

function definition(columns: ListColumn<Row>[], extra: Partial<ListDefinition<Row>> = {}): ListDefinition<Row> {
  return {
    key: 'rows',
    title: 'Rows',
    rowKey: (row) => row.id,
    rowLabel: (row) => row.id,
    columns,
    empty: { title: 'Nothing', description: 'Nothing yet' },
    ...extra,
  };
}

describe('defineList', () => {
  it('returns the definition it was given, untouched', () => {
    const list = definition([column('a', { default: true })]);

    expect(defineList(list)).toBe(list);
  });

  it('accepts exactly five columns by default and refuses six', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];

    expect(LIST_MAX_DEFAULT_COLUMNS).toBe(5);
    expect(() => defineList(definition(ids.map((id) => column(id, { default: true }))))).not.toThrow();
    expect(() => defineList(definition([...ids, 'f'].map((id) => column(id, { default: true }))))).toThrow(
      /6 columns are shown by default.*at most 5/,
    );
  });

  it('does not count the optional columns, however many there are', () => {
    const columns = [column('a', { default: true }), ...['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => column(id))];

    expect(() => defineList(definition(columns))).not.toThrow();
  });

  it('counts a column that cannot be hidden as shown by default', () => {
    const columns = [
      column('a', { always: true }),
      ...['b', 'c', 'd', 'e', 'f'].map((id) => column(id, { default: true })),
    ];

    expect(() => defineList(definition(columns))).toThrow(/6 columns are shown by default/);
  });

  it('wants at least one column and one of them shown', () => {
    expect(() => defineList(definition([]))).toThrow(/at least one column/);
    expect(() => defineList(definition([column('a')]))).toThrow(/at least one column must be `default`/);
  });

  it('refuses two columns with the same id, and an id that cannot travel in an address', () => {
    expect(() => defineList(definition([column('a', { default: true }), column('a')]))).toThrow(/column id "a" is used twice/);
    expect(() => defineList(definition([column('a,b', { default: true })]))).toThrow(/column id "a,b" must be made of letters/);
    expect(() => defineList(definition([column('a:b', { default: true })]))).toThrow(/must be made of letters/);
  });

  it('refuses a key with a space or a colon', () => {
    expect(() => defineList(definition([column('a', { default: true })], { key: 'my list' }))).toThrow(/key is required/);
    expect(() => defineList(definition([column('a', { default: true })], { key: 'a:b' }))).toThrow(/key is required/);
  });

  it('refuses more than one row header or card status', () => {
    expect(() => defineList(definition([column('a', { default: true, rowHeader: true }), column('b', { default: true, rowHeader: true })]))).toThrow(
      /only one column can be the `rowHeader`/,
    );
    expect(() => defineList(definition([column('a', { default: true, cardStatus: true }), column('b', { default: true, cardStatus: true })]))).toThrow(
      /only one column can be the `cardStatus`/,
    );
  });

  it('wants, in a list that opens its rows, a name column the person cannot hide: it is what the keyboard presses', () => {
    const named = [column('name', { default: true, always: true, rowHeader: true }), column('other', { default: true })];

    expect(() => defineList(definition(named, { rowHref: () => '/x' }))).not.toThrow();
    expect(() => defineList(definition(named, { detail: { title: () => 't', render: () => null } }))).not.toThrow();
    for (const extra of [{ rowHref: () => '/x' }, { detail: { title: () => 't', render: () => null } }]) {
      // No name column at all, or one the person can hide.
      expect(() => defineList(definition([column('a', { default: true })], extra))).toThrow(/needs a `rowHeader` column that is `always`/);
      expect(() => defineList(definition([column('name', { default: true, rowHeader: true })], extra))).toThrow(/needs a `rowHeader` column that is `always`/);
    }
  });

  it('checks the default chip, the default sort and the board exist', () => {
    const columns = [column('a', { default: true, sort: () => 1 }), column('b', { default: true })];
    const chips = [{ id: 'all', label: 'All' }];

    expect(() => defineList(definition(columns, { chips, defaultChip: 'nope' }))).toThrow(/default chip "nope"/);
    expect(() => defineList(definition(columns, { defaultSort: 'b:asc' }))).toThrow(/default sort "b:asc" must name a column that has `sort`/);
    expect(() => defineList(definition(columns, { defaultSort: 'a:desc' }))).not.toThrow();
    expect(() =>
      defineList(definition(columns, { chips, board: { columns: [], onMove: () => undefined } })),
    ).toThrow(/a board needs at least one column/);
    expect(() =>
      defineList(
        definition(columns, {
          chips,
          board: { defaultChip: 'nope', columns: [{ id: 'x', label: 'X', test: () => true, empty: '-' }], onMove: () => undefined },
        }),
      ),
    ).toThrow(/board's default chip "nope"/);
  });

  it('refuses two filters, views or bulk actions with the same id', () => {
    const columns = [column('a', { default: true })];
    const filter = { id: 'f', label: 'F', type: 'date' as const };

    expect(() => defineList(definition(columns, { filters: [filter, filter] }))).toThrow(/filter id "f" is used twice/);
    expect(() =>
      defineList(definition(columns, { views: [{ id: 'v', label: 'V', state: {} }, { id: 'v', label: 'W', state: {} }] })),
    ).toThrow(/view id "v" is used twice/);
    expect(() => defineList(definition(columns, { bulk: ['export', 'export'] }))).toThrow(/bulk action id "export" is used twice/);
  });

  it('accepts the list of stays of the tests (a little of everything)', () => {
    const list = stayList();

    expect(list.columns.filter((column) => column.default || column.always)).toHaveLength(5);
    expect(list.columns.some((column: ListColumn<Stay>) => !column.default)).toBe(true);
  });
});
