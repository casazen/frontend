import { ApiClient } from '@/api/client';
import type { SwissLocality, SwissMunicipality } from '@/types/swiss-places.types';

export const SWISS_SEARCH_MIN_LENGTH = 2;

export const SWISS_SEARCH_LIMIT = 20;

/**
 * Official directory of the Swiss localities and municipalities (swisstopo). Reference data with no personal data, but read only by
 * whoever may read properties: the access token is sent (never `public`).
 */
export const SwissPlacesApi = {
  searchLocalities: (query: string): Promise<SwissLocality[]> =>
    ApiClient.get<SwissLocality[]>('/swiss/localities', { query, limit: SWISS_SEARCH_LIMIT }),

  getMunicipality: (municipalityCode: string): Promise<SwissMunicipality> =>
    ApiClient.get<SwissMunicipality>(`/swiss/municipalities/${encodeURIComponent(municipalityCode)}`),
};
