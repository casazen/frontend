import { ApiClient } from '@/api/client';
import type { Comune, ComuneAvailability, ComuneSearchResponse } from '@/types/comune.types';

export const COMUNE_SEARCH_MIN_LENGTH = 2;

/** Official ISTAT comuni list (SU-04). Open data and anonymous on the backend: no access token is sent. */
export const ComuniApi = {
  getStatus: (): Promise<ComuneAvailability> =>
    ApiClient.get<ComuneAvailability>('/comuni/status', undefined, { public: true }),

  search: (query: string, limit = 10): Promise<ComuneSearchResponse> =>
    ApiClient.get<ComuneSearchResponse>('/comuni', { q: query, limit }, { public: true }),

  /** One comune by ISTAT code, also one no longer in the list (`isActive: false`); 404 when unknown. */
  getByIstatCode: (istatCode: string): Promise<Comune> =>
    ApiClient.get<Comune>(`/comuni/${encodeURIComponent(istatCode)}`, undefined, { public: true }),
};
