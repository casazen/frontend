import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onboardingApi } from '@/api/onboarding.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import type { AssistQueueQuery, AssistUpdateStatus } from '@/types/onboarding.types';

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
