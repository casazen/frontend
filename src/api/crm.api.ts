import { ApiClient } from './client';
import type {
  CrmProfileDetail,
  CrmProfileList,
  CrmProfileListParams,
  SendConfirmationResult,
  SetCrmTagsRequest,
} from '@/types/crm.types';

/**
 * CRM API (NF-23, NF-88, ADR-021): the guest profiles of the org, narrowed to the properties the caller reaches. The server applies
 * the scope (HostScope) to the list, to every filter, to the search and to the detail; a caller with no reach is refused (403), and a
 * profile of another org or out of reach is a 404 `crm_profile_not_found`, never a widened answer.
 */
export const CrmApi = {
  getGuests: (params?: CrmProfileListParams) => ApiClient.get<CrmProfileList>('/crm/guests', params),

  getGuest: (id: string) => ApiClient.get<CrmProfileDetail>(`/crm/guests/${id}`),

  setTags: (id: string, tags: string[]) => ApiClient.put<void>(`/crm/guests/${id}/tags`, { tags } satisfies SetCrmTagsRequest),

  sendConfirmation: (contactId: string) =>
    ApiClient.post<SendConfirmationResult>(`/crm/contacts/${contactId}/send-confirmation`),
};
