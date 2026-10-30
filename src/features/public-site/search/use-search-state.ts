import { useCallback, useMemo } from 'react';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import { readSearch, toStaysQuery, writeSearch } from './search-state';

type SearchPatch = Parameters<typeof writeSearch>[1];

/**
 * The search of the booking site as the address keeps it (DB-07c): the stay, the place, the filters, the sort and the view. Reading
 * is `readSearch`; every change goes through the writer of the stay (`useStayState`), so that a date chosen and a sort changed in
 * the same moment both land. The address is replaced, not added to: Back leaves the page for the one before it, and finds this one
 * again as it was, since the whole state is in the address. `query` is the call to the server for it.
 */
export function useSearchState(limits: Parameters<typeof useStayState>[0] = {}) {
  const stayState = useStayState(limits);
  const { stay, searchParams, writeQuery } = stayState;
  const search = useMemo(() => readSearch(searchParams), [searchParams]);
  const query = useMemo(() => toStaysQuery(stay, search), [stay, search]);
  const setSearch = useCallback((patch: SearchPatch) => writeQuery((current) => writeSearch(current, patch)), [writeQuery]);
  return { ...stayState, search, setSearch, query };
}
