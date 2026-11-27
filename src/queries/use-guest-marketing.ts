import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { guestMarketingApi } from '@/api/guest-marketing.api';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { GUEST_BOOKING_QUERY } from '@/queries/use-guest-session';
import type { GuestSession } from '@/types';
import type { GuestMarketing, GuestMarketingChange, GuestMarketingResend } from '@/types/guest-marketing.types';

const GUEST_MARKETING_QUERY = 'guest-marketing';

const CONSENT_OUTDATED_CODE = 'guest_marketing_consent_outdated';

function marketingKey(session: GuestSession, code: string) {
  return [GUEST_MARKETING_QUERY, code, session.expiresAt] as const;
}

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
