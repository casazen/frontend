import { useQuery } from '@tanstack/react-query';
import { SWISS_SEARCH_MIN_LENGTH, SwissPlacesApi } from '@/api/swiss-places.api';

const SWISS_PLACES_KEY = 'swiss-places';

/**
 * The directory changes with the yearly refresh of the official list, not while a host fills in a form: an answer is kept for ten
 * minutes. It is reference data (no list or detail of the host's own data), so nothing here has to be read again on mount.
 */
const DIRECTORY_STALE_TIME_MS = 10 * 60 * 1000;

/**
 * Search as the host types (`query` is already debounced by the caller): a postal code or the start of a name. Idle below the minimum
 * length. A failure is final for that query (a 422 `swiss_places_unavailable` is not retried: the picker says it) and the stored answer
 * of an earlier success must never be shown as the current one: read `isError` before `data`.
 */
export function useSwissLocalitySearch(query: string, enabled = true) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [SWISS_PLACES_KEY, 'search', trimmed],
    queryFn: () => SwissPlacesApi.searchLocalities(trimmed),
    enabled: enabled && trimmed.length >= SWISS_SEARCH_MIN_LENGTH,
    staleTime: DIRECTORY_STALE_TIME_MS,
  });
}

/**
 * The municipality of a stored BFS number (name and canton), for a record that does not carry them. 404 = the directory has no such
 * number (read `isError` before `data`: TanStack Query keeps the old data on an error).
 */
export function useSwissMunicipality(municipalityCode: string | null | undefined) {
  return useQuery({
    queryKey: [SWISS_PLACES_KEY, 'municipality', municipalityCode],
    queryFn: () => SwissPlacesApi.getMunicipality(municipalityCode as string),
    enabled: !!municipalityCode,
    staleTime: DIRECTORY_STALE_TIME_MS,
    retry: false,
  });
}
