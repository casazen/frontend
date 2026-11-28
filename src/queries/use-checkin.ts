import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { propertyDoorQrApi, publicCheckinApi } from '@/api/checkin.api';
import { bookingsApi } from '@/api/bookings.api';
import {
  CHECK_IN_LINK_EMAIL_ERRORS,
  type CheckInLinkResponse,
  type DoorCheckInRequest,
  type PublicCheckInSubmitRequest,
} from '@/types/public-checkin.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { isAxiosError } from 'axios';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { getProblemMessage } from '@/lib/api-errors';
import { readInvoiceDataProblems } from '@/lib/invoice-data-schema';
import { retryTransientErrors } from '@/lib/query-client';
import { CHECKIN_LINK_DELIVERY_KEY } from '@/queries/use-checkin-link-delivery';

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
 * The legal texts of the identity step of the stay of the link, in the language of the page (E22/F02/US01/T01): the consent the guest agrees to and, for a property that keeps no
 * document, the notice. The registry can publish a new version at any time, so they are always asked again when the step opens and never kept as fresh; they hold nothing personal.
 * Asked only while `enabled` (the guest is at the consent); an error is final for the guest to read, not an old answer.
 */
export function useGuestLegalTexts(token: string, language: string, enabled: boolean) {
  return useQuery({
    queryKey: [CHECKIN_KEY, token, 'legal-texts', language],
    queryFn: () => publicCheckinApi.getLegalTexts(token, language),
    enabled: enabled && !!token,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/**
 * The guest at the door (E22/F02/US01/T01): what was typed (a booking code or a surname, and a date) is personal data, so the mutation does not outlive the page (`gcTime: 0`) and what it keeps of
 * a failure is the answer without the request (`withoutRequest`: the status and the body stay, which is what the page turns into words, and the code or the surname do not). The answer holds the
 * token of the check-in link, a secret: it is dropped as soon as the page that asked is gone.
 */
export function useOpenDoorCheckIn(doorToken: string) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (request: DoorCheckInRequest) => {
      try {
        return await publicCheckinApi.openDoor(doorToken, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
  });
}

const DOOR_QR_KEY = 'door-qr';

/**
 * The address behind the QR of the door of a property (E22/F02/US01/T01): it holds the door token, so it is asked again every time the page opens and is not kept once the page is closed
 * (`gcTime: 0`). The first call makes the token. Asked only while `enabled` (the flag is on and the person may write the property: the server answers 403 otherwise).
 */
export function useDoorQr(propertyId: string, enabled: boolean) {
  return useQuery({
    queryKey: [DOOR_QR_KEY, propertyId],
    queryFn: () => propertyDoorQrApi.get(propertyId),
    enabled: enabled && !!propertyId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

export function useRotateDoorQr(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        return await propertyDoorQrApi.rotate(propertyId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (qr) => {
      queryClient.setQueryData([DOOR_QR_KEY, propertyId], qr);
    },
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

function isFieldValidationProblem(error: unknown): boolean {
  if (readInvoiceDataProblems(error).length > 0) return true;
  if (!isAxiosError(error) || error.response?.status !== 400) return false;
  const errors: unknown = (error.response.data as { errors?: unknown } | undefined)?.errors;
  return typeof errors === 'object' && errors !== null && Object.keys(errors).length > 0;
}

/**
 * Sends the check-in of the guest. The request holds the personal data of every guest (names, documents and, in Switzerland, the home and the plate of the car):
 * the mutation is dropped as soon as nothing observes it (`gcTime: 0`) and a refusal is kept without the request that was sent (`withoutRequest`: the status and the
 * body of the answer stay, which is what the page turns into words on the fields).
 */
export function useSubmitGuestCheckIn(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (data: PublicCheckInSubmitRequest) => {
      try {
        return await publicCheckinApi.submit(token, data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
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

export function useSetCheckInLanguage(token: string) {
  return useMutation({
    mutationFn: (language: string) => publicCheckinApi.setLanguage(token, language),
  });
}

const CHECKIN_EMAIL_POLL_MS = 5000;

export function useBookingCheckInSession(bookingId: string) {
  return useQuery({
    queryKey: [CHECKIN_SESSION_KEY, bookingId],
    queryFn: () => bookingsApi.getCheckInSession(bookingId),
    enabled: !!bookingId,
    refetchInterval: (query) => (query.state.data?.emailStatus === 'Queued' ? CHECKIN_EMAIL_POLL_MS : false),
  });
}

export function checkInEmailErrorLabel(code: string | null | undefined, t: (key: string) => string): string {
  const known = code && (CHECK_IN_LINK_EMAIL_ERRORS as readonly string[]).includes(code);
  const key = known ? code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) : 'unknown';
  return t(`checkin.link.emailError.${key}`);
}

function toastLinkEmail(data: CheckInLinkResponse) {
  if (data.emailStatus === 'Failed') {
    toast.error(i18n.t('checkin.link.toast.emailFailed', { reason: checkInEmailErrorLabel(data.emailError, i18n.t) }));
  } else {
    toast.success(i18n.t('checkin.link.toast.emailQueued'));
  }
}

function refreshLinkOf(queryClient: QueryClient, bookingId: string): void {
  void queryClient.invalidateQueries({ queryKey: [CHECKIN_SESSION_KEY, bookingId] });
  void queryClient.invalidateQueries({ queryKey: [CHECKIN_LINK_DELIVERY_KEY, bookingId] });
}

export function useResendCheckInLink(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => bookingsApi.resendCheckInLink(bookingId),
    onSuccess: (data) => {
      refreshLinkOf(queryClient, bookingId);
      toastLinkEmail(data);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('checkin.resendError'));
    },
  });
}

export function useSendCheckInLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => bookingsApi.resendCheckInLink(bookingId),
    onSuccess: (data, bookingId) => {
      refreshLinkOf(queryClient, bookingId);
      toastLinkEmail(data);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('checkin.resendError'));
    },
  });
}

export function useCreateCheckInLink(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => bookingsApi.createCheckInLink(bookingId),
    onSuccess: () => {
      refreshLinkOf(queryClient, bookingId);
      toast.success(i18n.t('checkin.link.toast.generated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('checkin.generateError'));
    },
  });
}
