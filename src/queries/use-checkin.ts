import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicCheckinApi } from '@/api/checkin.api';
import { bookingsApi } from '@/api/bookings.api';
import { CHECK_IN_LINK_EMAIL_ERRORS, type PublicCheckInSubmitRequest } from '@/types/public-checkin.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { isAxiosError } from 'axios';
import { getProblemMessage } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';

const CHECKIN_KEY = 'checkin';
const CHECKIN_SESSION_KEY = 'checkin-session';

export function useCheckInContext(token: string) {
  return useQuery({
    queryKey: [CHECKIN_KEY, token],
    queryFn: () => publicCheckinApi.getContext(token),
    enabled: !!token,
    retry: retryTransientErrors(1),
  });
}

/** 400 ValidationProblem with field errors: the check-in page shows them on the fields, not in a toast. */
function isFieldValidationProblem(error: unknown): boolean {
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
      toast.success(i18n.t('toast.checkInDataSaved'));
    },
    onError: (error) => {
      if (isFieldValidationProblem(error)) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.checkInDataSaveFailed'));
    },
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

/**
 * Sends a new link by email (also the reminder). The toast says what really happened: the email is queued, or it could
 * not be sent and the host copies the link, which the response always carries (A5-26).
 */
export function useResendCheckInLink(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => bookingsApi.resendCheckInLink(bookingId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_SESSION_KEY, bookingId] });
      if (data.emailStatus === 'Failed') {
        toast.error(i18n.t('checkin.link.toast.emailFailed', { reason: checkInEmailErrorLabel(data.emailError, i18n.t) }));
      } else {
        toast.success(i18n.t('checkin.link.toast.emailQueued'));
      }
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
