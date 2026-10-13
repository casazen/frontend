import { isStayDate } from '@/lib/stay-dates';
import type {
  ListDefinition,
  ListFilter,
  ListLayout,
  ListPresetState,
  ListSort,
  ListSortDirection,
} from './list-types';

/**
 * The state of a list lives in the address, and only there (UI-14): the search, the quick filter, the filters, the order, the
 * columns, the layout and the page. A refresh, the Back button, a link that is shared and the way back from a detail page
 * all give the list as it was left. This file is the pure part: from the address to a state and back, with no React in it.
 *
 *     /app/short-rent/guests?q=rossi&chip=arrivals&f_country=IT&sort=lastStay:desc&cols=guest,email&view=board&page=2
 *
 * What is not asked for is the default and is not written, so the plain address is the plain list; what is not valid (a chip,
 * a filter value, a column that the list does not have) is ignored, so a stale link or a typed address never breaks the page.
 */

/** The parameters the list owns; any other parameter of the address (`propertyId`, `tab`) is left alone. */
export const LIST_PARAM = {
  q: 'q',
  chip: 'chip',
  sort: 'sort',
  columns: 'cols',
  layout: 'view',
  page: 'page',
} as const;

const FILTER_PREFIX = 'f_';
const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE = 100_000;

export interface ListState {
  /** As typed: the spaces at the end are the person's (they type "mario " before "mario rossi"); trim it where it is used. */
  q: string;
  /** Always the id of a chip when the list has any, the default one if the address names none; `''` otherwise. */
  chip: string;
  /** Only the filters that are on and valid: the value as the address writes it (`IT`, `airbnb,direct`, `2026-10-01..2026-10-31`). */
  filters: Readonly<Record<string, string>>;
  sort: ListSort | null;
  /** The columns the person chose, in the order of the list; `null` when they are the default ones. */
  columns: readonly string[] | null;
  layout: ListLayout;
  /** From 1; for what a server pages. */
  page: number;
}

/** The quick filter a list starts from: the one of the board in the columns layout, the default one otherwise. */
export function defaultChipId<Row>(def: ListDefinition<Row>, layout: ListLayout): string {
  const chips = def.chips ?? [];
  if (chips.length === 0) return '';
  return (layout === 'board' ? def.board?.defaultChip : undefined) ?? def.defaultChip ?? chips[0].id;
}

/** The columns that are there when the person has chosen none. */
export function defaultColumnIds<Row>(def: ListDefinition<Row>): string[] {
  return def.columns.filter((column) => column.default || column.always).map((column) => column.id);
}

/** `lastStay:desc` as a sort, or `null` when it names no sortable column. A direction is `asc` when missing. */
export function parseSortValue<Row>(def: ListDefinition<Row>, value: string | null | undefined): ListSort | null {
  if (!value) return null;
  const [id, rawDirection, ...rest] = value.split(':');
  if (rest.length > 0 || !def.columns.some((column) => column.id === id && column.sort)) return null;
  if (rawDirection !== undefined && rawDirection !== 'asc' && rawDirection !== 'desc') return null;
  const direction: ListSortDirection = rawDirection === 'desc' ? 'desc' : 'asc';
  return { id, direction };
}

export function formatSortValue(sort: ListSort): string {
  return `${sort.id}:${sort.direction}`;
}

const DATE_RANGE = /^(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$/;

/** `2026-10-01..2026-10-31`, `..2026-10-31`, `2026-10-01..`: the two ends of a range of dates, each one optional. */
export function parseDateRange(value: string): { from?: string; to?: string } {
  const match = DATE_RANGE.exec(value);
  if (!match) return {};
  const [, from, to] = match;
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

export function formatDateRange(range: { from?: string; to?: string }): string {
  return `${range.from ?? ''}..${range.to ?? ''}`;
}

/** `airbnb,direct` as `['airbnb', 'direct']`. */
export function parseMultiValue(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeDateRange(value: string): string | null {
  const { from, to } = parseDateRange(value);
  if (!from && !to) return null;
  if ((from && !isStayDate(from)) || (to && !isStayDate(to))) return null;
  if (from && to && from > to) return null;
  return formatDateRange({ from, to });
}

/** The value of a filter as the address writes it, or `null` if it is not a valid one (it is then ignored). */
export function normalizeFilterValue<Row>(filter: ListFilter<Row>, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (filter.type === 'date') return normalizeDateRange(value);

  // Options drawn from the rows are not known here: only a fixed list can tell a stale value from a good one.
  const options = typeof filter.options === 'function' ? null : filter.options;
  if (filter.type === 'select') {
    return !options || options.some((option) => option.value === value) ? value : null;
  }
  const picked = [...new Set(parseMultiValue(value))];
  const valid = options ? options.map((option) => option.value).filter((id) => picked.includes(id)) : picked;
  return valid.length > 0 ? valid.join(',') : null;
}

function sameColumns(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * The columns a person chose, as the state keeps them: in the order of the list (whatever order they were ticked in), with the
 * ones that cannot be hidden, and `null` when they are the default ones. Names the list does not have are dropped; with none
 * left, the default columns.
 */
export function normalizeColumnIds<Row>(def: ListDefinition<Row>, ids: readonly string[] | null): readonly string[] | null {
  if (!ids) return null;
  const wanted = new Set(ids);
  if (!def.columns.some((column) => wanted.has(column.id))) return null;
  const chosen = def.columns.filter((column) => column.always || wanted.has(column.id)).map((column) => column.id);
  return sameColumns(chosen, defaultColumnIds(def)) ? null : chosen;
}

/** The state an address stands for. Never throws: what is not valid is dropped. */
export function readListState<Row>(def: ListDefinition<Row>, params: URLSearchParams): ListState {
  const layout: ListLayout = def.board && params.get(LIST_PARAM.layout) === 'board' ? 'board' : 'list';

  const requestedChip = params.get(LIST_PARAM.chip);
  const chip = (def.chips ?? []).some((candidate) => candidate.id === requestedChip)
    ? (requestedChip as string)
    : defaultChipId(def, layout);

  const filters: Record<string, string> = {};
  for (const filter of def.filters ?? []) {
    const raw = params.get(`${FILTER_PREFIX}${filter.id}`);
    if (raw === null) continue;
    const value = normalizeFilterValue(filter, raw);
    if (value !== null) filters[filter.id] = value;
  }

  const sort = parseSortValue(def, params.get(LIST_PARAM.sort)) ?? parseSortValue(def, def.defaultSort);

  const requestedColumns = params.get(LIST_PARAM.columns);
  const columns = requestedColumns ? normalizeColumnIds(def, parseMultiValue(requestedColumns)) : null;

  const page = Number.parseInt(params.get(LIST_PARAM.page) ?? '', 10);

  return {
    q: (params.get(LIST_PARAM.q) ?? '').slice(0, MAX_SEARCH_LENGTH),
    chip,
    filters,
    sort,
    columns,
    layout,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** The parameters of a state, without what is the default, in an order that does not change (a stable, readable address). */
export function listStateToParams<Row>(def: ListDefinition<Row>, state: ListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set(LIST_PARAM.q, state.q);
  if (state.chip && state.chip !== defaultChipId(def, state.layout)) params.set(LIST_PARAM.chip, state.chip);
  for (const filter of def.filters ?? []) {
    const value = state.filters[filter.id];
    if (value) params.set(`${FILTER_PREFIX}${filter.id}`, value);
  }
  const defaultSort = parseSortValue(def, def.defaultSort);
  if (state.sort && (state.sort.id !== defaultSort?.id || state.sort.direction !== defaultSort.direction)) {
    params.set(LIST_PARAM.sort, formatSortValue(state.sort));
  }
  if (state.columns && !sameColumns(state.columns, defaultColumnIds(def))) {
    params.set(LIST_PARAM.columns, state.columns.join(','));
  }
  if (state.layout === 'board') params.set(LIST_PARAM.layout, 'board');
  if (state.page > 1) params.set(LIST_PARAM.page, String(state.page));
  return params;
}

/** The names of the parameters this list owns in an address. */
function ownParamNames<Row>(def: ListDefinition<Row>): string[] {
  return [...Object.values(LIST_PARAM), ...(def.filters ?? []).map((filter) => `${FILTER_PREFIX}${filter.id}`)];
}

/** `current` with the parameters of the list replaced by those of `state`; the others are kept as they were. */
export function applyListState<Row>(def: ListDefinition<Row>, current: URLSearchParams, state: ListState): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const name of ownParamNames(def)) next.delete(name);
  for (const [name, value] of listStateToParams(def, state)) next.append(name, value);
  return next;
}

/** The state a view stands for (a view that comes with the list, or one the person saved as a query string). */
export function presetToState<Row>(def: ListDefinition<Row>, preset: ListPresetState): ListState {
  const params = new URLSearchParams();
  if (preset.q) params.set(LIST_PARAM.q, preset.q);
  if (preset.chip) params.set(LIST_PARAM.chip, preset.chip);
  for (const [id, value] of Object.entries(preset.filters ?? {})) params.set(`${FILTER_PREFIX}${id}`, value);
  if (preset.sort) params.set(LIST_PARAM.sort, preset.sort);
  if (preset.columns && preset.columns.length > 0) params.set(LIST_PARAM.columns, preset.columns.join(','));
  if (preset.layout === 'board') params.set(LIST_PARAM.layout, 'board');
  return readListState(def, params);
}

/** What a saved view keeps of a state: everything but the page. */
export function viewQuery<Row>(def: ListDefinition<Row>, state: ListState): string {
  return listStateToParams(def, { ...state, page: 1 }).toString();
}

/** The same view (the page does not count). */
export function isSameView<Row>(def: ListDefinition<Row>, a: ListState, b: ListState): boolean {
  return viewQuery(def, a) === viewQuery(def, b);
}

export function activeFilterCount(state: ListState): number {
  return Object.keys(state.filters).length;
}

/**
 * The list is narrowed down: a search, a filter, or a quick filter other than the first (the one for "everything"). With
 * nothing in the list, this is what tells "there is nothing yet" from "nothing passes".
 */
export function isRefined<Row>(def: ListDefinition<Row>, state: ListState): boolean {
  const chips = def.chips ?? [];
  return state.q.trim() !== '' || activeFilterCount(state) > 0 || (chips.length > 0 && state.chip !== chips[0].id);
}

/** The state "Azzera i filtri" leads to: no search, no filter, the quick filter for everything; the order, columns and layout stay. */
export function clearedState<Row>(def: ListDefinition<Row>, state: ListState): ListState {
  return { ...state, q: '', filters: {}, chip: (def.chips ?? [])[0]?.id ?? '', page: 1 };
}
