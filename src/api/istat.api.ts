import { ApiClient } from './client';
import type { IstatRegionRule, PropertyIstatCoverage, SaveIstatRegionRequest } from '@/types/istat.types';

/**
 * The ISTAT region table and the coverage of a property (E21/F01/US01/T01). The screens never call axios: they compose the hooks of `src/queries/use-istat-regions`, which call these
 * methods. The table is platform data, written only by a platform administrator (403 to anyone else); the coverage of a property is read by whoever reaches the property and answers
 * 404 while the backend flag `Features:OctorateOnboarding` is off (the web flag is `octorateOnboarding`).
 */
export const istatApi = {
  /** `GET /admin/istat-regions`: the whole table, the regions in the order of their ISTAT code (platform admin only). */
  listRegions: () => ApiClient.get<IstatRegionRule[]>('/admin/istat-regions'),

  /**
   * `PUT /admin/istat-regions`: saves the row of a territory (it never creates one) and stamps it verified, with one line of the audit trail. 404 `istat_region_not_found`; 422
   * `istat_region_source_invalid`, `istat_region_portal_invalid`, `istat_region_deadline_invalid`, `istat_region_fields_invalid`.
   */
  saveRegion: (request: SaveIstatRegionRequest) => ApiClient.put<IstatRegionRule>('/admin/istat-regions', request),

  /**
   * `GET /properties/{propertyId}/istat-coverage`: the region of the property, its system, deadline, whether the channel manager covers it and what to do next. 403 for a property the
   * caller does not reach, 404 `property_not_found` for another org's.
   */
  getCoverage: (propertyId: string) => ApiClient.get<PropertyIstatCoverage>(`/properties/${encodeURIComponent(propertyId)}/istat-coverage`),
};
