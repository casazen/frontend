import { ApiClient } from './client';
import type { GuestCrmProfileList, GuestCrmListParams, GuestCrmProfile } from '@/types/crm.types';

/**
 * CRM API (NF-23, ADR-021): guest profiles scoped to the caller's HostScope,
 * for marketing and segmentation.
 */
export const CrmApi = {
  /**
   * Get paginated list of CRM guest profiles, filtered by HostScope (ADR-021-R8):
   * only profiles with stays at properties the caller reaches.
   */
  getGuests: (params?: GuestCrmListParams) =>
    ApiClient.get<GuestCrmProfileList>('/crm/guests', params),

  /**
   * Get a single guest CRM profile by ID.
   */
  getGuest: (id: string) =>
    ApiClient.get<GuestCrmProfile>(`/crm/guests/${id}`),
};
