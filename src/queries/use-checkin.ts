import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicCheckinApi } from '@/api/checkin.api';
import { bookingsApi } from '@/api/bookings.api';
import {
  CHECK_IN_LINK_EMAIL_ERRORS,
  type CheckInLinkResponse,
  type PublicCheckInSubmitRequest,
} from '@/types/public-checkin.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { isAxiosError } from 'axios';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { getProblemMessage } from '@/lib/api-errors';
import { readInvoiceDataProblems } from '@/lib/invoice-data-schema';
import { retryTransientErrors } from '@/lib/query-client';

const CHECKIN_KEY = 'checkin';
export const CHECKIN_SESSION_KEY = 'checkin-session';

export function useCheckInContext(token: string) {
  return useQuery({
    queryKey: [CHECKIN_KEY, token],
    queryFn: () => publicCheckinApi.getContext(token),
    enabled: !!token,
    retry: retryTransientErrors(1),
  });
}

/**
 * The tourist tax of the stay of the link, for the guest page (E25/F01/US02/T01). It lives under the key of the context (`['checkin', token, 'tourist-tax']`), so whatever reads the context
 * again after the guest sent the check-in reads the tax again too: the guests are on file by then, and the amount is the one of the stay as it stands. Always read again when the page opens
 * and when the guest comes back to it, and never kept as fresh: a payment, the host's «Pagata in struttura» or a change of the tax moves it without the guest. Asked only when `enabled`
 * (the flag `touristTaxOnlinePayment` is on and the link is known); a 404 or a 409 is final and is not tried again.
 */
export function useGuestTouristTax(token: string, enabled: boolean) {
  return useQuery({
    queryKey: [CHECKIN_KEY, token, 'tourist-tax'],
    queryFn: () => publicCheckinApi.getTouristTax(token),
    enabled: enabled && !!token,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/**
 * The PaymentIntent the Payment Element of the tourist tax opens with. It carries the client secret of the intent, so the mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`, not five minutes in the cache of the mutations) and a refusal is kept without the request (`withoutRequest`: the status and the body of the answer stay, which is
 * what the page turns into words, and the address with the token of the link does not).
 */
export function useCreateTouristTaxPaymentIntent(token: string) {
  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        return await publicCheckinApi.createTouristTaxPaymentIntent(token);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
  });
}

/**
 * 400 ValidationProblem with field errors, or the 422 of the invoice block (FIS-01, it names its fields): the check-in page shows them on the
 * fields, in the language of the page, not in a toast.
 */
function isFieldValidationProblem(error: unknown): boolean {
  if (readInvoiceDataProblems(error).length > 0) return true;
  if (!isAxiosError(error) || error.response?.status !== 400) return false;
  const errors: unknown = (error.response.data as { errors?: unknown } | undefined)?.errors;
  return typeof errors === 'object' && errors !== null && Object.keys(errors).length > 0;
}

export function useSubmitGuestCheckIn(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PublicCheckInSubmitRequest) => publicCheckinApi.submit(token, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_KEY, token] });
      toast.success(i18n.t('checkin.toast.saved'));
    },
    onError: (error) => {
      if (isFieldValidationProblem(error)) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('checkin.toast.saveFailed'));
    },
  });
}

/**
 * Saves the language the guest chose on the page. Nothing is shown here: the page already changed language, and tells the guest only
 * when the choice could not be saved. The context in the cache is left alone: the choice lives in the page (`chosenLocale`) and on the
 * server, and a new `context` object would reset the form the guest is filling in.
 */
export function useSetCheckInLanguage(token: string) {
  return useMutation({
    mutationFn: (language: string) => publicCheckinApi.setLanguage(token, language),
  });
}

/** While the link email is queued, the host view polls its real outcome (sent or failed). */
export const CHECKIN_EMAIL_POLL_MS = 5000;

export function useBookingCheckInSession(bookingId: string) {
  return useQuery({
    queryKey: [CHECKIN_SESSION_KEY, bookingId],
    queryFn: () => bookingsApi.getCheckInSession(bookingId),
    enabled: !!bookingId,
    refetchInterval: (query) => (query.state.data?.emailStatus === 'Queued' ? CHECKIN_EMAIL_POLL_MS : false),
  });
}

/** Translated reason of a failed link email (`no_recipient` → `checkin.link.emailError.noRecipient`; unknown codes get a generic reason). */
export function checkInEmailErrorLabel(code: string | null | undefined, t: (key: string) => string): string {
  const known = code && (CHECK_IN_LINK_EMAIL_ERRORS as readonly string[]).includes(code);
  const key = known ? code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) : 'unknown';
  return t(`checkin.link.emailError.${key}`);
}

/** What really happened to the email of a new link: queued, or not sent (and the host copies the link, which the response always carries, A5-26). */
function toastLinkEmail(data: CheckInLinkResponse) {
  if (data.emailStatus === 'Failed') {
    toast.error(i18n.t('checkin.link.toast.emailFailed', { reason: checkInEmailErrorLabel(data.emailError, i18n.t) }));
  } else {
    toast.success(i18n.t('checkin.link.toast.emailQueued'));
  }
}

/** Sends a new link by email (also the reminder). The toast says what really happened to the email. */
export function useResendCheckInLink(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => bookingsApi.resendCheckInLink(bookingId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_SESSION_KEY, bookingId] });
      toastLinkEmail(data);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('checkin.resendError'));
    },
  });
}

/** The same call for a list (SR-04): the booking is the one given to `mutate`, so one hook serves the menu of every row. */
export function useSendCheckInLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => bookingsApi.resendCheckInLink(bookingId),
    onSuccess: (data, bookingId) => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_SESSION_KEY, bookingId] });
      toastLinkEmail(data);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('checkin.resendError'));
    },
  });
}

/** Generates a new link to copy, without email. */
export function useCreateCheckInLink(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => bookingsApi.createCheckInLink(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_SESSION_KEY, bookingId] });
      toast.success(i18n.t('checkin.link.toast.generated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('checkin.generateError'));
    },
  });
}
