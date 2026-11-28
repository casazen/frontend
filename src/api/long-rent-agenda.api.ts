import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type { LongRentDeadlines, LongRentDeadlinesParams, LongRentOverview } from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const longRentAgendaApi = {
  getOverview: async (): Promise<LongRentOverview> => {
    const data = await ApiClient.get<unknown>('/long-rent/overview');
    if (!isRecord(data) || !isRecord(data.leases) || !isRecord(data.rents)) {
      throw new UnexpectedApiResponseError('/long-rent/overview');
    }
    return data as unknown as LongRentOverview;
  },

  getDeadlines: async (params: LongRentDeadlinesParams = {}): Promise<LongRentDeadlines> => {
    const data = await ApiClient.get<unknown>('/long-rent/deadlines', params);
    if (!isRecord(data) || !Array.isArray(data.items)) {
      throw new UnexpectedApiResponseError('/long-rent/deadlines');
    }
    return data as unknown as LongRentDeadlines;
  },
};
