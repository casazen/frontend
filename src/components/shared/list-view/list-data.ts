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

/** Lowercase without accents, so that "citta" finds "Città" and "MARIO" finds "Mario". */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

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
  ignoreChip?: boolean;
  filters?: Readonly<Record<string, string>>;
}

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

export function sortListRows<Row>(def: ListDefinition<Row>, rows: readonly Row[], sort: ListSort | null, locale: string): Row[] {
  const valueOf = sort ? def.columns.find((column) => column.id === sort.id)?.sort : undefined;
  if (!sort || !valueOf) return [...rows];

  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
    return collator.compare(String(left), String(right)) * sign;
  });
}

export function visibleColumns<Row>(def: ListDefinition<Row>, chosen: readonly string[] | null): ListColumn<Row>[] {
  const ids = new Set(chosen ?? defaultColumnIds(def));
  return def.columns.filter((column) => column.always || ids.has(column.id));
}

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

export function resolveOptions<Row>(options: ListOptions<Row>, rows: readonly Row[]): readonly ListOption[] {
  return typeof options === 'function' ? options(rows) : options;
}

export function chipCount<Row>(chip: ListChip<Row>, rows: readonly Row[]): number {
  if (!chip.urgent) return 0;
  if (chip.count) return chip.count(rows);
  return chip.test ? rows.filter(chip.test).length : rows.length;
}
