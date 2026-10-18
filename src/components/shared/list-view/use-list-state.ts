import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useListReturn } from '@/hooks/use-list-return';
import { applyListState, clearedState, defaultChipId, normalizeColumnIds, presetToState, readListState, type ListState } from './list-state';
import type { ListDefinition, ListLayout, ListPresetState, ListSort } from './list-types';

export interface UseListState {
  /** What the address says now: the search, the quick filter, the filters, the order, the columns, the layout, the page. */
  state: ListState;
  /**
   * The search text. `typing` is for text that is still being typed: the first change adds a step to the history and the ones
   * that follow replace it, so that Back after typing "rossi" does not walk back through "r", "ro", "ros".
   */
  setQ: (q: string, options?: { typing?: boolean }) => void;
  setChip: (chip: string) => void;
  /** All the filters at once (the panel applies them together). */
  setFilters: (filters: Record<string, string>) => void;
  setSort: (sort: ListSort | null) => void;
  setColumns: (columns: readonly string[] | null) => void;
  setLayout: (layout: ListLayout) => void;
  setPage: (page: number) => void;
  /** "Azzera i filtri": no search, no filter, the quick filter for everything. */
  clear: () => void;
  /** A saved view: its query string. */
  applyQuery: (query: string) => void;
  /** A view that comes with the list. */
  applyPreset: (preset: ListPresetState) => void;
}

/**
 * The state of a list, in the address (UI-14): read from it and written to it, nowhere else (see `list-state` for what the
 * parameters are). A change adds a step to the browser history, so Back gives the previous view of the list, and a detail
 * page that is left with Back finds the list as it was; the window does not jump to the top (`preventScrollReset`). The
 * parameters that are not the list's (`propertyId`, `tab`) are left alone.
 *
 * It also remembers the list for the way back from a page of detail (`useListReturn`).
 *
 * A page that asks a server for its rows reads the state with this hook too, to build the query; the list component reads and
 * writes the same address, so both see the same thing.
 */
export function useListState<Row>(def: ListDefinition<Row>): UseListState {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  useListReturn(pathname);

  const state = useMemo(() => readListState(def, params), [def, params]);

  // The address as of now. A change builds on this and not on what was rendered last, so that two changes made before React
  // has rendered (a search that settles just as a chip is pressed) do not undo each other: `setSearchParams` of the router
  // builds on the render and would.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  }, [params]);
  // The address a "typing" change left, to tell the entry it made from one that Back or a link has put in its place.
  const typed = useRef<string | null>(null);

  const commit = useCallback(
    (change: (current: ListState) => ListState, options: { typing?: boolean } = {}) => {
      const current = latest.current;
      const next = applyListState(def, current, change(readListState(def, current)));
      if (next.toString() === current.toString()) return;
      const continuesTyping = options.typing === true && typed.current === current.toString();
      typed.current = options.typing ? next.toString() : null;
      latest.current = next;
      setParams(next, { replace: continuesTyping, preventScrollReset: true });
    },
    [def, setParams],
  );

  return useMemo<UseListState>(
    () => ({
      state,
      setQ: (q, options) => commit((current) => ({ ...current, q, page: 1 }), options),
      setChip: (chip) => commit((current) => ({ ...current, chip, page: 1 })),
      setFilters: (filters) => commit((current) => ({ ...current, filters, page: 1 })),
      setSort: (sort) => commit((current) => ({ ...current, sort, page: 1 })),
      setColumns: (columns) => commit((current) => ({ ...current, columns: normalizeColumnIds(def, columns) })),
      setLayout: (layout) =>
        commit((current) => ({
          ...current,
          layout,
          // Each layout starts from its own quick filter (the board from "everything"): follow it unless the person chose another.
          chip: current.chip === defaultChipId(def, current.layout) ? defaultChipId(def, layout) : current.chip,
          page: 1,
        })),
      setPage: (page) => commit((current) => ({ ...current, page })),
      clear: () => commit((current) => clearedState(def, current)),
      applyQuery: (query) => commit(() => readListState(def, new URLSearchParams(query))),
      applyPreset: (preset) => commit(() => presetToState(def, preset)),
    }),
    [state, commit, def],
  );
}
