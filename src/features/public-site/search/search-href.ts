import { BOOKING_QUERY_KEYS } from '@/lib/booking-url';
import { WHERE_PARAM } from '@/features/public-site/stay/use-stay-state';

const SEARCH_KEYS: readonly string[] = [...Object.values(BOOKING_QUERY_KEYS), 'pets', WHERE_PARAM];

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
