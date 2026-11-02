import { BOOKING_QUERY_KEYS } from '@/lib/booking-url';
import { WHERE_PARAM } from '@/features/public-site/stay/use-stay-state';

/** The parts of the address that make the search of the site: the stay (dates, guests, pet) and the place. */
const SEARCH_KEYS: readonly string[] = [...Object.values(BOOKING_QUERY_KEYS), 'pets', WHERE_PARAM];

/**
 * A link to the results of the site (`basePath` is `/book/:slug/search`) that carries the stay and the place of `current` and
 * changes what `patch` says (a value of `null` removes the part). Anything else in the address (the language, the section of the
 * home) stays behind: it is not part of the search.
 */
export function searchHref(basePath: string, current: URLSearchParams, patch: Record<string, string | null> = {}): string {
  const next = new URLSearchParams();
  for (const key of SEARCH_KEYS) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}
