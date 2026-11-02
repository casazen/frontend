import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { LongRentPropertyAggregate } from '@/types';
import { ApiClient } from './client';

/** The properties of the long-term area with their APE, cadastral data, who holds them and the change of mode programmed (LR-07a). */
export const longRentPropertiesApi = {
  /** Every property of the caller's reach in long-term mode. The parts that come from the leases are `null` for who may not read them. */
  getAll: async (): Promise<LongRentPropertyAggregate[]> => {
    const data = await ApiClient.get<unknown>('/long-rent/properties');
    if (!Array.isArray(data)) throw new UnexpectedApiResponseError('/long-rent/properties');
    return data as LongRentPropertyAggregate[];
  },
};
