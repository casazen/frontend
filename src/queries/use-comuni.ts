import { useQuery } from '@tanstack/react-query';
import { COMUNE_SEARCH_MIN_LENGTH, ComuniApi } from '@/api/comuni.api';

const COMUNI_KEY = 'comuni';

/** The list changes with an import by an admin, a few times a year: checked once per session and on a new mount after 10 minutes. */
const STATUS_STALE_TIME_MS = 10 * 60 * 1000;

/** Whether the official ISTAT list is imported (the pickers say so when it is not). */
export function useComuneDatasetStatus() {
  return useQuery({
    queryKey: [COMUNI_KEY, 'status'],
    queryFn: ComuniApi.getStatus,
    staleTime: STATUS_STALE_TIME_MS,
    // A failed check is shown with its own retry button, not retried silently: the form below must not wait for it.
    retry: false,
  });
}

/** Search as the user types (`query` is already debounced by the caller); idle below the minimum length. */
export function useComuneSearch(query: string, enabled = true) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [COMUNI_KEY, 'search', trimmed],
    queryFn: () => ComuniApi.search(trimmed),
    enabled: enabled && trimmed.length >= COMUNE_SEARCH_MIN_LENGTH,
    staleTime: STATUS_STALE_TIME_MS,
  });
}

/** The comune of a stored ISTAT code (name, province, region), also one no longer in the list. */
export function useComune(istatCode: string | null | undefined) {
  return useQuery({
    queryKey: [COMUNI_KEY, 'by-code', istatCode],
    queryFn: () => ComuniApi.getByIstatCode(istatCode as string),
    enabled: !!istatCode,
    staleTime: STATUS_STALE_TIME_MS,
    retry: false,
  });
}
