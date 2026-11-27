import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onboardingApi } from '@/api/onboarding.api';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import type {
  AssistQueueQuery,
  AssistUpdateStatus,
  StoreSupportVaultSecretRequest,
  SupportVaultCredentialKind,
  SupportVaultReveal,
} from '@/types/onboarding.types';

/** The staff queue of the «Do it for me» requests (`/admin/onboarding/assist-requests`, UX-15, NF-107). */
export const ADMIN_ASSIST_KEY = ['admin', 'onboarding-assist'] as const;

/**
 * A page of the staff queue (`GET /admin/onboarding/assist-requests?status=&page=&pageSize=`), paged and ordered by the server (open requests first, the oldest
 * first; `pageSize` at most 100): it carries identifiers, context codes, the property and its comune, never a draft nor a secret. Other staff (and the hosts' own
 * pages) change the requests, so the queue is read again at every visit and after a short time on screen; the page that was on screen stays until the next one
 * arrives, so paging does not blink. Platform administrator only: a page that anyone can open passes `enabled: false` for the others and sends nothing.
 * 422 `assist_status_invalid` for a status that is not one of the four.
 */
export function useAssistQueue(params: AssistQueueQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ADMIN_ASSIST_KEY, 'list', params],
    queryFn: () => onboardingApi.listAssistQueue(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    staleTime: 15 * 1000,
  });
}

/**
 * One request with its checklist (`GET /admin/onboarding/assist-requests/{id}`, E20/F03/US01/T02): what support needs for each property, as presence and dates, never a
 * credential. It lives under the key of the queue, so whatever reads the queue again (a live notice, an update of the request) reads the checklist again too, and it is
 * read at every visit and after a short time on screen: the host enters the ISTAT credentials, or reopens the request, while support has it open. A 404 is «not found»
 * whatever the cache still holds. Platform administrator only.
 */
export function useAssistRequestDetail(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ADMIN_ASSIST_KEY, 'detail', id],
    queryFn: () => onboardingAssistApi.getRequestDetail(id),
    enabled: id !== '' && (options?.enabled ?? true),
    refetchOnMount: 'always',
    staleTime: 15 * 1000,
  });
}

interface UpdateVariables {
  id: string;
  status: AssistUpdateStatus;
  /** At most 500 characters, no e-mail address: the server refuses it (422 `assist_note_invalid`) and the dialog says so under the field. */
  note?: string;
}

/**
 * Takes a request, completes it or cancels it, with an optional note (`PUT /admin/onboarding/assist-requests/{id}`). The server writes the line of the log of the
 * organization of the request with the staff user as the actor, and for a request that is done it closes the «Da fare» of the host. The queue is read again after
 * it, also after a refusal (409 `assist_request_closed`: somebody closed it first), and a success says «Richiesta aggiornata». The note is free text, so the
 * mutation is dropped as soon as nothing observes it (`gcTime: 0`) and a failure is kept without the request that was sent (`withoutRequest`); the screen turns the
 * failure into words next to the field (422 `assist_note_invalid`, `assist_status_invalid`, 404 `assist_request_not_found`).
 */
export function useUpdateAssistRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, note }: UpdateVariables) => {
      try {
        return await onboardingApi.updateAssistRequest(id, note ? { status, note } : { status });
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => toast.success(i18n.t('onboardingPlan.assist.updated')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ADMIN_ASSIST_KEY }),
  });
}

interface RevealVariables {
  id: string;
  kind: SupportVaultCredentialKind;
  /** 10 to 300 characters: kept in the audit of the opening, never shown to the host. */
  reason: string;
  /** Takes the values of the opening, the one and only way they leave the call: they are in the state of the dialog that asked, and nowhere else. */
  onOpened: (values: SupportVaultReveal) => void;
}

/**
 * The controlled opening of the support vault (`POST /admin/onboarding/assist-requests/{id}/reveal`, E20/F03/US01/T01, decision O5): the values of one credential, in
 * clear, for an open request, with a reason. They are the one thing in the app that must not stay anywhere, so the call is a mutation that does not hold them: the
 * values go to `onOpened` (the state of the dialog, which drops them after a minute, when it closes and when it goes away) and the mutation resolves with nothing,
 * so there is no `data` of the mutation to keep them, no query to cache them, and the mutation itself is dropped as soon as nothing observes it (`gcTime: 0`). A failure
 * is kept without the request (`withoutRequest`); the dialog turns it into words (404 `support_vault_secret_missing`, 409 `support_vault_request_not_open`, 422
 * `support_vault_reason_invalid` and `support_vault_kind_not_for_request`, 429 `support_vault_too_many_openings`). Nothing here is toasted, and nothing is invalidated:
 * an opening changes nothing the lists show (the audit line is the host's, in its activity log).
 */
export function useRevealAssistSecret() {
  return useMutation({
    mutationFn: async ({ id, kind, reason, onOpened }: RevealVariables): Promise<void> => {
      let values: SupportVaultReveal;
      try {
        values = await onboardingAssistApi.revealSecret(id, { kind, reason });
      } catch (error) {
        throw withoutRequest(error);
      }
      onOpened(values);
    },
    gcTime: 0,
  });
}

/**
 * Stores, or replaces, a credential of an org in the support vault (`PUT /admin/onboarding/support-vault`): the user of the panel of a structure, copied from the welcome
 * message that reached the CasaZen address of the org. Write-only: the answer is its presence. The values leave the form as soon as the server has them; the mutation
 * is dropped as soon as nothing observes it (`gcTime: 0`) and a failure is kept without the request (`withoutRequest`). The queue and the checklists are read again after
 * it, so the checklist shows the credential as there. 404 `support_vault_org_not_found`, `property_not_found`; 422 `support_vault_value_invalid`.
 */
export function useStoreSupportVaultSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: StoreSupportVaultSecretRequest) => {
      try {
        return await onboardingAssistApi.storeVaultSecret(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => toast.success(i18n.t('onboardingPlan.assist.vault.saved')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ADMIN_ASSIST_KEY }),
  });
}
