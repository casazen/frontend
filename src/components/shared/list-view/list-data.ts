import { defaultColumnIds, parseDateRange, parseMultiValue, type ListState } from './list-state';
import type {
  ListCardContent,
  ListCell,
  ListChip,
  ListColumn,
  ListDefinition,
  ListFilter,
  ListOption,
  ListOptions,
  ListSort,
} from './list-types';

/**
 * What a list does with its rows when the page hands over all of them (`client` mode): the search, the quick filter, the
 * filters, the order, and which columns are there. Pure functions, no React: they are what the tests lean on.
 */

/** Lowercase without accents, so that "citta" finds "Città" and "MARIO" finds "Mario". */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Every word of `query` is somewhere in `text` (in any order, as part of a word). No words: everything matches. */
export function matchesSearch(text: string, query: string): boolean {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearchText(text);
  return words.every((word) => haystack.includes(word));
}

function passesFilter<Row>(filter: ListFilter<Row>, row: Row, value: string): boolean {
  switch (filter.type) {
    case 'select':
      return filter.test ? filter.test(row, value) : true;
    case 'multi':
      return filter.test ? filter.test(row, parseMultiValue(value)) : true;
    case 'date':
      return filter.test ? filter.test(row, parseDateRange(value)) : true;
  }
}

export interface FilterRowsOptions {
  /** Leave the quick filter out: what the counters of the chips count. */
  ignoreChip?: boolean;
  /** Other filters than those of the state: the draft in the panel of the filters, to count what it would give. */
  filters?: Readonly<Record<string, string>>;
}

/** The rows that pass the quick filter, the search and the filters. */
export function filterListRows<Row>(
  def: ListDefinition<Row>,
  rows: readonly Row[],
  state: Pick<ListState, 'q' | 'chip' | 'filters'>,
  options: FilterRowsOptions = {},
): Row[] {
  const chip = options.ignoreChip ? undefined : def.chips?.find((candidate) => candidate.id === state.chip);
  const filters = options.filters ?? state.filters;
  const searching = state.q.trim() !== '';

  return rows.filter((row) => {
    if (chip?.test && !chip.test(row)) return false;
    if (searching && !matchesSearch(def.search?.text?.(row) ?? def.rowLabel(row), state.q)) return false;
    return (def.filters ?? []).every((filter) => {
      const value = filters[filter.id];
      return !value || passesFilter(filter, row, value);
    });
  });
}

/** The rows in the order of `sort`: numbers as numbers, words as words of the language, what is missing last. */
export function sortListRows<Row>(def: ListDefinition<Row>, rows: readonly Row[], sort: ListSort | null, locale: string): Row[] {
  const valueOf = sort ? def.columns.find((column) => column.id === sort.id)?.sort : undefined;
  if (!sort || !valueOf) return [...rows];

  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    // Whatever has no value goes last, in either direction.
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
    return collator.compare(String(left), String(right)) * sign;
  });
}

/** The columns on show: the ones the person chose, or the default ones; the `always` ones are there in any case. */
export function visibleColumns<Row>(def: ListDefinition<Row>, chosen: readonly string[] | null): ListColumn<Row>[] {
  const ids = new Set(chosen ?? defaultColumnIds(def));
  return def.columns.filter((column) => column.always || ids.has(column.id));
}

/**
 * The card a row makes of itself from the priorities of the columns on show: the lowest number is the title, the next the line
 * under it, the others small items below (with the name of the column for a screen reader); the `cardStatus` column goes top
 * right. A row with no column that has a priority is its label.
 */
export function autoCardContent<Row>(list: ListDefinition<Row>, columns: readonly ListColumn<Row>[], row: Row, cell: ListCell): ListCardContent {
  const byPriority = columns
    .filter((column) => column.priority !== undefined && !column.cardStatus)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const statusColumn = columns.find((column) => column.cardStatus);
  const [first, second, ...rest] = byPriority;
  return {
    title: first ? first.render(row, cell) : list.rowLabel(row),
    sub: second ? second.render(row, cell) : undefined,
    status: statusColumn ? statusColumn.render(row, cell) : undefined,
    meta: rest.map((column) => ({ text: column.render(row, cell), label: column.label })),
  };
}

/** The choices of a filter, now: the fixed list, or what is drawn from the rows. */
export function resolveOptions<Row>(options: ListOptions<Row>, rows: readonly Row[]): readonly ListOption[] {
  return typeof options === 'function' ? options(rows) : options;
}

/** The number on a chip that needs attention (an `urgent` one); 0 means no number. */
export function chipCount<Row>(chip: ListChip<Row>, rows: readonly Row[]): number {
  if (!chip.urgent) return 0;
  if (chip.count) return chip.count(rows);
  return chip.test ? rows.filter(chip.test).length : rows.length;
}
