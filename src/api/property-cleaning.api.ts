import { ApiClient } from './client';
import type { BulkSaveCleaningSetupDto, CleaningSetupBulkResponse, PropertyCleaningSetup, SaveCleaningSetupDto } from '@/types';

/**
 * The default cleaner of a property at the check-out of its stays, with the price and the time agreed (E24/F01/US01/T01): what the routine action `CreateCleaningRequest` reads.
 * Every call asks for `property.write` (the setup holds a price): another org's property is a 404 `property_not_found`, a property of the org the caller may not manage a 403.
 */
export const propertyCleaningApi = {
  /** The setup of a property, or the defaults when it has none (`configured: false`). */
  get: (propertyId: string) => ApiClient.get<PropertyCleaningSetup>(`/properties/${encodeURIComponent(propertyId)}/cleaning-setup`),

  /** Saves the whole setup of a property (what is left out is cleared) and answers with what is stored. 422 with a code of `cleaning_setup_*` when a rule stops it. */
  save: (propertyId: string, dto: SaveCleaningSetupDto) =>
    ApiClient.put<PropertyCleaningSetup>(`/properties/${encodeURIComponent(propertyId)}/cleaning-setup`, dto),

  /** The same setup for many properties: 200 with one result for each, also when some could not be saved (never «all saved» when one was not). */
  saveBulk: (dto: BulkSaveCleaningSetupDto) => ApiClient.put<CleaningSetupBulkResponse>('/properties/cleaning-setup/bulk', dto),
};
