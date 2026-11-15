import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { toast } from 'sonner';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import type { AlloggiatiStatusDto } from '@/types/alloggiati.types';
import type { StayGuestSubmit } from '@/types/public-checkin.types';

export const ALLOGGIATI_KEY = 'alloggiati';

export function useAlloggiatiSummary(propertyId?: string) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'summary', propertyId ?? 'all'],
    queryFn: () => alloggiatiApi.getSummary(propertyId),
  });
}

/**
 * The Alloggiati Web status of a stay. A screen that edits the guests of the stay while it is open (the check-out wizard) asks `refetchOnMount: 'always'`:
 * the client does not read an unobserved query again by default, and the status it holds may be older than the data the host has just completed. The page of the
 * booking asks it too, with a short `staleTime`: the guests are written to the channel manager meanwhile, by the retry job or on their own (E20/F01).
 */
export function useAlloggiatiStatus(bookingId: string, enabled = true, options: { refetchOnMount?: boolean | 'always'; staleTime?: number } = {}) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'status', bookingId],
    queryFn: () => alloggiatiApi.getStatus(bookingId),
    enabled: !!bookingId && enabled,
    ...options,
  });
}

/**
 * The summary of the guests of a stay, as the record of the portal holds them: names, birth, citizenship, document (masked). A screen that shows it in a layer that
 * goes away (the editor of the guests inside the check-out wizard) asks `gcTime: 0`, so that nothing of it stays in the cache once the layer is closed; the default
 * keeps it for ten minutes after the last screen that used it.
 */
export function useAlloggiatiGuestSummary(bookingId: string, options: { gcTime?: number } = {}) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'guest-summary', bookingId],
    queryFn: () => alloggiatiApi.getGuestSummary(bookingId),
    enabled: !!bookingId,
    ...options,
  });
}

/**
 * The host asks to try again to write the guests of the stay to the channel manager (`POST`, needs `alloggiati.submit`). The answer is the status of the stay as it is
 * afterwards plus what the retry did (`retry`, the message under the button): the status goes into the cache without that part, so it stays a status, and the other
 * screens that show the stay (the proofs and the log of the booking, the cockpit) are read again. A refusal (409 while another send of the stay runs, 403, 404) leaves the
 * status as it was and reads it again, so the screen shows what is true now. The request holds nothing of a guest, but the mutation is dropped as soon as nobody watches it
 * (`gcTime: 0`) and keeps a failure without its request, as the other writes about guests do.
 */
export function useRetryOctorateWrite(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (): Promise<AlloggiatiStatusDto> => {
      try {
        return await alloggiatiApi.retryOctorateWrite(bookingId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (answer) => {
      queryClient.setQueryData<AlloggiatiStatusDto>([ALLOGGIATI_KEY, 'status', bookingId], { ...answer, retry: null });
      void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY, 'booking', bookingId] });
      void queryClient.invalidateQueries({ queryKey: ['compliance'] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY, 'status', bookingId] });
    },
  });
}

export function useMarkAlloggiatiSentManually() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, sentOn }: { bookingId: string; sentOn: string }) =>
      alloggiatiApi.markSentManually(bookingId, { sentOn }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY] });
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast.success(i18n.t('toast.alloggiatiMarkedSent'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.alloggiatiMarkSentFailed'));
    },
  });
}

/**
 * Host entry of the guests of the stay (CO-12). Field errors (400) are shown on the form by the caller; other errors get
 * a toast with the problem message.
 */
export function useReplaceStayGuests(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guests: StayGuestSubmit[]) => alloggiatiApi.replaceStayGuests(bookingId, guests),
    onSuccess: (summary) => {
      queryClient.setQueryData([ALLOGGIATI_KEY, 'guest-summary', bookingId], summary);
      queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY] });
      toast.success(i18n.t('alloggiati.editGuests.saved'));
    },
  });
}
