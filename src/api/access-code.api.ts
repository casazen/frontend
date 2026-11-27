import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { AccessCodeStatusPage, SetAccessCodeRequest } from '@/types';
import { ApiClient } from './client';

const STATUS_PATH = '/properties/access-codes';

/** The lock code of the entrance of each property (ADR-013): the host writes it, nobody reads it back. */
export const accessCodeApi = {
  /**
   * One page of the properties the caller reaches, each with "code set or missing" and when it was set. The answer never carries a
   * code. A body that is not that shape (the SPA's `index.html` behind a wrong rewrite) is a load error, not an empty list.
   */
  getStatus: async (params: { page: number; pageSize: number }): Promise<AccessCodeStatusPage> => {
    const data = await ApiClient.get<AccessCodeStatusPage | undefined>(STATUS_PATH, params);
    if (!data || !Array.isArray(data.items)) throw new UnexpectedApiResponseError(STATUS_PATH);
    return data;
  },

  /** Sets or changes the code of a property. The code travels only in the body of this request, never in the address. */
  setCode: (propertyId: string, request: SetAccessCodeRequest) =>
    ApiClient.post<void>(`/properties/${propertyId}/access-code`, request),
};
