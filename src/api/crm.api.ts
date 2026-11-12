import { ApiClient } from './client';
import type { CrmProfileList, CrmProfileListParams } from '@/types/crm.types';

/**
 * CRM API (NF-23, NF-88, ADR-021): the guest profiles of the org, narrowed to the properties the caller reaches. The server applies
 * the scope (HostScope) to the list, to every filter and to the search; a caller with no reach is refused (403), never widened.
 */
export const CrmApi = {
  /**
   * One page of the profiles, filtered and sorted (`GET api/crm/guests`). The e-mail of an item is masked, and there is no document,
   * birth date or birth place in it.
   */
  getGuests: (params?: CrmProfileListParams) => ApiClient.get<CrmProfileList>('/crm/guests', params),
};
