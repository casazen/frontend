import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { LongRentPropertyAggregate } from '@/types';
import { ApiClient } from './client';

export const longRentPropertiesApi = {
  getAll: async (): Promise<LongRentPropertyAggregate[]> => {
    const data = await ApiClient.get<unknown>('/long-rent/properties');
    if (!Array.isArray(data)) throw new UnexpectedApiResponseError('/long-rent/properties');
    return data as LongRentPropertyAggregate[];
  },
};
