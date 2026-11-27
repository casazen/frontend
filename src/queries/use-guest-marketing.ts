import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { guestMarketingApi } from '@/api/guest-marketing.api';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { GUEST_BOOKING_QUERY } from '@/queries/use-guest-session';
import type { GuestSession } from '@/types';
import type { GuestMarketing, GuestMarketingChange, GuestMarketingResend } from '@/types/guest-marketing.types';

const GUEST_MARKETING_QUERY = 'guest-marketing';

/** 409 of the change: the version of the consent text the page showed is not the current one. */
const CONSENT_OUTDATED_CODE = 'guest_marketing_consent_outdated';

function marketingKey(session: GuestSession, code: string) {
  return [GUEST_MARKETING_QUERY, code, session.expiresAt] as const;
}

/**
 * The marketing choices of the guest of the booking, per channel (E07/F04/US02/T03, NF-90). Read when the section opens and when the guest
 * comes back to the tab: the confirmation of an e-mail happens in another window. The masked address and number are not kept once the
 * section is gone (`gcTime: 0`), so nothing of them outlives the guest's session in this browser. A 401 means the session ended: the
 * booking is read again, which finds it out and sends the guest back to the form. A 404 means the booking has no choices to show: the
 * section hides itself.
 */
export function useGuestMarketing(session: GuestSession, code: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: marketingKey(session, code),
    queryFn: async () => {
      try {
        return await guestMarketingApi.get(session.accessToken, code);
      } catch (error) {
        if (getHttpStatus(error) === 401) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
        throw error;
      }
    },
    gcTime: 0,
    staleTime: 10_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/**
 * Changes the choices (a consent with the version of the text the page showed, or a withdrawal) and puts the answer, which is the choices as
 * they are then, in place of what the section shows. A mutation never retries by itself (`queryClient`): a withdrawal is final. When the
 * text changed meanwhile (409) the section reads again, and shows the new version.
 */
export function useSaveGuestMarketing(session: GuestSession, code: string) {
  const queryClient = useQueryClient();
  return useMutation<GuestMarketing, unknown, GuestMarketingChange>({
    mutationFn: (change) => guestMarketingApi.save(session.accessToken, code, change),
    onSuccess: (marketing) => queryClient.setQueryData(marketingKey(session, code), marketing),
    onError: (error) => {
      if (getHttpStatus(error) === 401) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
      else if (isAxiosError(error) && getProblemCode(error.response?.data) === CONSENT_OUTDATED_CODE) {
        void queryClient.invalidateQueries({ queryKey: [GUEST_MARKETING_QUERY, code] });
      }
    },
  });
}

/**
 * Asks for the confirmation e-mail of the pending e-mail consent again. The server limits it (three messages, one every ten minutes) and says
 * in the answer whether it queued one (`sent`); the choices are read again, since whether it can be asked once more has changed.
 */
export function useResendMarketingConfirmation(session: GuestSession, code: string) {
  const queryClient = useQueryClient();
  return useMutation<GuestMarketingResend, unknown, void>({
    mutationFn: () => guestMarketingApi.resendConfirmation(session.accessToken, code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: marketingKey(session, code) }),
    onError: (error) => {
      if (getHttpStatus(error) === 401) void queryClient.invalidateQueries({ queryKey: [GUEST_BOOKING_QUERY] });
    },
  });
}
