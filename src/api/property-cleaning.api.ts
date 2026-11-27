import { ApiClient } from './client';
import type { BulkSaveCleaningSetupDto, CleaningSetupBulkResponse, PropertyCleaningSetup, SaveCleaningSetupDto } from '@/types';

export const propertyCleaningApi = {
  get: (propertyId: string) => ApiClient.get<PropertyCleaningSetup>(`/properties/${encodeURIComponent(propertyId)}/cleaning-setup`),

  save: (propertyId: string, dto: SaveCleaningSetupDto) =>
    ApiClient.put<PropertyCleaningSetup>(`/properties/${encodeURIComponent(propertyId)}/cleaning-setup`, dto),

  saveBulk: (dto: BulkSaveCleaningSetupDto) => ApiClient.put<CleaningSetupBulkResponse>('/properties/cleaning-setup/bulk', dto),
};
