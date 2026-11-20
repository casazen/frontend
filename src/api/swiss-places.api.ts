import { ApiClient } from '@/api/client';
import type { SwissLocality, SwissMunicipality } from '@/types/swiss-places.types';

/**
 * Shortest query the picker sends: two characters (a postal code or the start of a name). The API itself answers an empty list below
 * that, which would look like "no such place".
 */
export const SWISS_SEARCH_MIN_LENGTH = 2;

/** Most items one search returns (`ISwissPlacesDirectory.MaxLimit`): the API brings a larger `limit` down to it. */
export const SWISS_SEARCH_LIMIT = 20;

/**
 * Official directory of the Swiss localities and municipalities (swisstopo). Reference data with no personal data, but read only by
 * whoever may read properties: the access token is sent (never `public`).
 */
export const SwissPlacesApi = {
  /**
   * The localities whose postal code starts with the query (one to four digits, `CH-` ignored) or whose name contains it (case and
   * accents ignored), exact matches first. 422 `swiss_places_unavailable` when the directory is not loaded: an empty list means "no
   * such place" only for a directory that is there.
   */
  searchLocalities: (query: string): Promise<SwissLocality[]> =>
    ApiClient.get<SwissLocality[]>('/swiss/localities', { query, limit: SWISS_SEARCH_LIMIT }),

  /** One municipality by its BFS number; 404 `swiss_municipality_unknown` when the directory has none, 422 `swiss_places_unavailable` when it is not loaded. */
  getMunicipality: (municipalityCode: string): Promise<SwissMunicipality> =>
    ApiClient.get<SwissMunicipality>(`/swiss/municipalities/${encodeURIComponent(municipalityCode)}`),
};
