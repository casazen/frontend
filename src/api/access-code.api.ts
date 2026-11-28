import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { AccessCodeStatusPage, SetAccessCodeRequest } from '@/types';
import { ApiClient } from './client';

const STATUS_PATH = '/properties/access-codes';

export const accessCodeApi = {
  getStatus: async (params: { page: number; pageSize: number }): Promise<AccessCodeStatusPage> => {
    const data = await ApiClient.get<AccessCodeStatusPage | undefined>(STATUS_PATH, params);
    if (!data || !Array.isArray(data.items)) throw new UnexpectedApiResponseError(STATUS_PATH);
    return data;
  },

  setCode: (propertyId: string, request: SetAccessCodeRequest) =>
    ApiClient.post<void>(`/properties/${propertyId}/access-code`, request),
};
