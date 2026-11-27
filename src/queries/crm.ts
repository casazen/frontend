import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CrmApi } from '@/api/crm.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type { CrmProfileDetail, CrmProfileList, CrmProfileListParams } from '@/types/crm.types';

/** Root of every query key of the CRM profiles. */
export const CRM_KEY = 'crm';

/** The pages of the list of profiles, whatever the filters: what a change of a profile reads again. */
export const CRM_GUESTS_KEY = [CRM_KEY, 'guests'] as const;

/** Every profile in detail, whatever its id: what a merge (which changes two of them) reads again. */
export const CRM_GUEST_KEY = [CRM_KEY, 'guest'] as const;

/** The query key of one profile in detail. */
export function crmGuestKey(id: string) {
  return [...CRM_GUEST_KEY, id] as const;
}

/**
 * One page of the CRM profiles (NF-88, ADR-021), narrowed by the server to the properties the caller reaches. The list changes on
 * other screens, some of which know nothing of it: the tags and the contacts of a profile, a merge, and a consent withdrawn or a guest
 * erased in the privacy tab of the guest record. The query client does not read again on mount, and `true` would still skip a read
 * less than five minutes old (the staleTime of the client), leaving "reachable" on a guest who has just withdrawn the consent; so every
 * visit of the list reads again (`'always'`, as the profile and the proposals do). The rows of the last page stay on the screen,
 * dimmed, until those of the next one arrive.
 */
export function useGuestCrmProfiles(params?: CrmProfileListParams) {
  return useQuery({
    queryKey: [...CRM_GUESTS_KEY, params],
    queryFn: () => CrmApi.getGuests(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export interface CrmOverview {
  guests: number;
  reachableByEmail: number;
  returned: number;
  loyal: number;
}

const OVERVIEW_FILTERS: readonly CrmProfileListParams[] = [{}, { reachableByEmail: true }, { minStays: 2 }, { minStays: 3 }];
const OVERVIEW_STALE_MS = 60_000;

function combineOverview(results: ReadonlyArray<{ data: number | undefined }>): CrmOverview | undefined {
  const counts = results.map((result) => result.data);
  if (counts.some((count) => count === undefined)) return undefined;
  const [guests, reachableByEmail, returned, loyal] = counts as number[];
  return { guests, reachableByEmail, returned, loyal };
}

// Same key as the list: whatever refreshes the list (a merge, a tag) refreshes these counts too.
export function useCrmOverview(): CrmOverview | undefined {
  return useQueries({
    queries: OVERVIEW_FILTERS.map((filters) => ({
      queryKey: [...CRM_GUESTS_KEY, 'overview', filters],
      queryFn: () => CrmApi.getGuests({ ...filters, page: 1, pageSize: 1 }),
      select: (list: CrmProfileList) => list.totalCount,
      staleTime: OVERVIEW_STALE_MS,
    })),
    combine: combineOverview,
  });
}

/**
 * One profile by its id (`GET api/crm/guests/{id}`): a reload of the page, or a link from another screen, works without the list. A
 * profile of another org or out of the caller's reach is a 404 `crm_profile_not_found`. It is read again on every visit: it changes
 * on other screens (a merge) and without any (the guest answers the confirmation e-mail).
 */
export function useGuestCrmProfile(id: string | undefined) {
  return useQuery({
    queryKey: crmGuestKey(id ?? ''),
    queryFn: () => CrmApi.getGuest(id!),
    enabled: !!id,
    refetchOnMount: 'always',
  });
}

/**
 * Replaces the tags of a profile (`PUT api/crm/guests/{id}/tags`). What the server accepted is what the page shows from now on, and the
 * list reads its tags again; a refusal (422 `crm_tags_invalid`, 404 `crm_profile_not_found`) is told in plain words and the profile is
 * read again, so the page shows what the server has.
 */
export function useSaveProfileTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => CrmApi.setTags(id, tags),
    onSuccess: (_result, { id, tags }) => {
      queryClient.setQueryData<CrmProfileDetail>(crmGuestKey(id), (profile) => (profile ? { ...profile, tags } : profile));
      void queryClient.invalidateQueries({ queryKey: CRM_GUESTS_KEY });
      toast.success(i18n.t('crm.tags.success'));
    },
    onError: (error, { id }) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('crm.tags.error'));
      void queryClient.invalidateQueries({ queryKey: crmGuestKey(id) });
    },
  });
}

/**
 * Asks for the confirmation e-mail of a contact (`POST api/crm/contacts/{id}/send-confirmation`, the double opt-in of a consent that was
 * never confirmed). The profile is read again, after a success and after a refusal alike: the contact may have been confirmed or
 * suppressed meanwhile. 409 `crm_confirmation_limit_reached`, 409 `crm_contact_suppressed` and 422 `crm_confirmation_not_required`
 * are told in plain words; `sent: false` says one went out a few minutes ago and nothing was sent now.
 */
export function useSendContactConfirmation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId }: { contactId: string; profileId: string }) => CrmApi.sendConfirmation(contactId),
    onSuccess: (result, { profileId }) => {
      void queryClient.invalidateQueries({ queryKey: crmGuestKey(profileId) });
      if (result.sent) toast.success(i18n.t('crm.contacts.confirmationSent'));
      else toast.info(i18n.t('crm.contacts.confirmationTooSoon'));
    },
    onError: (error, { profileId }) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('crm.contacts.confirmationError'));
      void queryClient.invalidateQueries({ queryKey: crmGuestKey(profileId) });
    },
  });
}
