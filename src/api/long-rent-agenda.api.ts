import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type { LongRentDeadlines, LongRentDeadlinesParams, LongRentOverview } from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The overview and the agenda of the long-term area (LR-01): what the landlord has to do now, the leases by group, the rent of
 * the month, and the dates to keep. Only reads, for the leases the landlord reaches.
 */
export const longRentAgendaApi = {
  /** The overview of today. */
  getOverview: async (): Promise<LongRentOverview> => {
    const data = await ApiClient.get<unknown>('/long-rent/overview');
    if (!isRecord(data) || !isRecord(data.leases) || !isRecord(data.rents)) {
      throw new UnexpectedApiResponseError('/long-rent/overview');
    }
    return data as unknown as LongRentOverview;
  },

  /** The dates of a window, in date order, the ones past and still open first when the window holds today. */
  getDeadlines: async (params: LongRentDeadlinesParams = {}): Promise<LongRentDeadlines> => {
    const data = await ApiClient.get<unknown>('/long-rent/deadlines', params);
    if (!isRecord(data) || !Array.isArray(data.items)) {
      throw new UnexpectedApiResponseError('/long-rent/deadlines');
    }
    return data as unknown as LongRentDeadlines;
  },
};
