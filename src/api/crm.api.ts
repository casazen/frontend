import { ApiClient } from './client';
import type { GuestCrmProfileList, GuestCrmListParams } from '@/types/crm.types';

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
};
