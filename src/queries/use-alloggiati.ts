import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type { AlloggiatiReportFilters } from '@/types/alloggiati.types';
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
 * the client does not read an unobserved query again by default, and the status it holds may be older than the data the host has just completed.
 */
export function useAlloggiatiStatus(bookingId: string, enabled = true, options: { refetchOnMount?: boolean | 'always' } = {}) {
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

/**
 * List of Alloggiati Web reports with filters (NF-14). The list changes as reports are sent or receive errors, so it
 * reads again when the page is opened.
 */
export function useAlloggiatiReports(filters?: AlloggiatiReportFilters) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'reports', filters],
    queryFn: () => alloggiatiApi.getReports(filters),
    refetchOnMount: true,
  });
}

/**
 * Row-level errors for a specific Alloggiati report (AC-NF14-3). Errors are displayed with TipoErrore codes from the
 * Test operation.
 */
export function useAlloggiatiErrors(reportId: string) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'errors', reportId],
    queryFn: () => alloggiatiApi.getReportErrors(reportId),
    enabled: !!reportId,
  });
}
