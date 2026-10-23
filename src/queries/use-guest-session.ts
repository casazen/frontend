import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { guestSessionApi } from '@/api/guest-session.api';
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
 * - `openSession` proves a booking with its code and email (404 whatever does not match, 429 when the limits are hit) and starts the
 *   session; nothing is retried by itself.
 * - `closeSession` is "Esci": the token is forgotten and so is everything read with it.
 */
export function useGuestSession(siteSlug: string) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<GuestSession | null>(() => readGuestSession(siteSlug));

  const openSession = useMutation({
    mutationFn: (payload: GuestBookingLookupPayload) => guestSessionApi.openSession(payload),
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
