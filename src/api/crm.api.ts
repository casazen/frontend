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
  /**
   * One page of the profiles, filtered and sorted (`GET api/crm/guests`). The e-mail of an item is masked, and there is no document,
   * birth date or birth place in it.
   */
  getGuests: (params?: CrmProfileListParams) => ApiClient.get<CrmProfileList>('/crm/guests', params),

  /** One profile in detail (`GET api/crm/guests/{id}`): the history, the totals, the reviews, the tags and the contacts. */
  getGuest: (id: string) => ApiClient.get<CrmProfileDetail>(`/crm/guests/${id}`),

  /** Replaces the tags of a profile (`PUT api/crm/guests/{id}/tags`, 204): at most 50, each 1 to 40 characters, no two alike. */
  setTags: (id: string, tags: string[]) => ApiClient.put<void>(`/crm/guests/${id}/tags`, { tags } satisfies SetCrmTagsRequest),

  /**
   * Asks for the double opt-in e-mail of a contact to be sent now, or again (`POST api/crm/contacts/{id}/send-confirmation`, 202):
   * `sent` is `false` when the last one went out less than ten minutes ago.
   */
  sendConfirmation: (contactId: string) =>
    ApiClient.post<SendConfirmationResult>(`/crm/contacts/${contactId}/send-confirmation`),
};
