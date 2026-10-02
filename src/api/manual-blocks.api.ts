import { ApiClient } from './client';
import type { CreateManualBlockDto, ManualBlockDto } from '@/types/calendar.types';

/** Dates the host closes by hand on a property (PC-09): owner stay, maintenance, other. */
export const manualBlocksApi = {
  create: (propertyId: string, data: CreateManualBlockDto) =>
    ApiClient.post<ManualBlockDto>(`/properties/${propertyId}/blocks`, data),

  remove: (propertyId: string, blockId: string) =>
    ApiClient.delete<void>(`/properties/${propertyId}/blocks/${blockId}`),
};
