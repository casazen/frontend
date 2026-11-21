import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { guestSessionApi } from '@/api/guest-session.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { clearGuestSession, readGuestSession, writeGuestSession } from '@/lib/guest-session';
import type { GuestBookingLookupPayload, GuestSession } from '@/types';

export const GUEST_BOOKING_QUERY = 'guest-booking';

/** True for the 401 of the guest area: the token is missing, altered or expired, and the guest has to prove the booking again. */
export function isGuestSessionRefused(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}

/**
 * The session of the guest of a booking site, with no account (DB-06a): the signed token that opening it gives, kept in
 * `sessionStorage` of the tab per site (never the email) and read back when the page is opened again. The features of the guest area
 * (messages, reviews…) read `session` and send its token with `guestSessionHeaders`.
 *
 * - `openSession` proves a booking with its code and one proof, the email or the last four digits of the phone (404 whatever does not match, 429 when
 *   the limits are hit) and starts the session; nothing is retried by itself. What the guest typed is personal data, so the mutation does not outlive the page
 *   (`gcTime: 0`) and what it keeps of a failure is the answer without the request (`withoutRequest`: the status and the body stay, which is what the page turns
 *   into words; the body that was sent, with the email or the digits, does not).
 * - `closeSession` is "Esci": the token is forgotten and so is everything read with it.
 */
export function useGuestSession(siteSlug: string) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<GuestSession | null>(() => readGuestSession(siteSlug));

  const openSession = useMutation({
    gcTime: 0,
    mutationFn: async (payload: GuestBookingLookupPayload) => {
      try {
        return await guestSessionApi.openSession(payload);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (opened) => {
      writeGuestSession(siteSlug, opened);
      setSession(opened);
    },
  });

  const closeSession = () => {
    clearGuestSession(siteSlug);
    queryClient.removeQueries({ queryKey: [GUEST_BOOKING_QUERY] });
    openSession.reset();
    setSession(null);
  };

  return { session, openSession, closeSession };
}

/**
 * The booking of the session as the guest sees it. Read again when the page opens: the state of a booking moves (a payment
 * completes, the check-in opens). A 401 means the token is no longer good: it is forgotten here, so the page falls back to the form.
 * The end of the session is in the key, so a new session never reads the error of the old one.
 */
export function useGuestBooking(siteSlug: string, session: GuestSession | null) {
  return useQuery({
    queryKey: [GUEST_BOOKING_QUERY, siteSlug, session?.bookingCode ?? '', session?.expiresAt ?? ''] as const,
    queryFn: async () => {
      // `enabled` keeps this from running without a session.
      if (!session) throw new Error('No guest session');
      try {
        return await guestSessionApi.getBooking(session.accessToken, session.bookingCode);
      } catch (error) {
        if (isGuestSessionRefused(error)) clearGuestSession(siteSlug);
        throw error;
      }
    },
    enabled: session !== null,
    staleTime: 60_000,
    refetchOnMount: 'always',
    // Not at every return to the tab: a token that was refused would be sent again each time.
    refetchOnWindowFocus: false,
  });
}
