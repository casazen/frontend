import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CrmApi } from '@/api/crm.api';
import type { CrmProfileListParams } from '@/types/crm.types';

/** Root of every query key of the CRM profiles. */
export const CRM_KEY = 'crm';

/** The pages of the list of profiles, whatever the filters: what a change of a profile reads again. */
export const CRM_GUESTS_KEY = [CRM_KEY, 'guests'] as const;

/**
 * One page of the CRM profiles (NF-88, ADR-021), narrowed by the server to the properties the caller reaches. The list changes on
 * other screens (the tags and the contacts of a profile, a merge), and the query client does not read again on mount, so a visit of
 * the list does; the rows of the last page stay on the screen, dimmed, until those of the next one arrive.
 */
export function useGuestCrmProfiles(params?: CrmProfileListParams) {
  return useQuery({
    queryKey: [...CRM_GUESTS_KEY, params],
    queryFn: () => CrmApi.getGuests(params),
    placeholderData: keepPreviousData,
    refetchOnMount: true,
  });
}
