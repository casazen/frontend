import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { publicSupplierApi } from '@/api/public-supplier.api';
import { publicBookingApi, type PublicBookingAccess, type PublicBookingBody, type PublicBookingView } from '@/api/public-supplier-booking.api';
import { readRequestFailure, type RequestFailure } from '@/lib/supplier-site/request-errors';

/** The slots are cached for 30 seconds on the server: asking again sooner would tell nothing new. */
const SLOTS_STALE_MS = 30_000;
/** Four weeks of free times are offered, seven days at a time. */
const SLOT_WINDOW_DAYS = 28;
/** The urgent slots are only today and tomorrow. */
const URGENT_WINDOW_DAYS = 3;
/** While the card is not blocked yet the page asks the e-mail check again every few seconds. */
const AWAITING_PAYMENT_POLL_MS = 4000;

/**
 * The free times of a service for the booking: four weeks, or only today and tomorrow when the person asked for an urgent one. A time
 * shown is not a promise: the booking checks it again.
 */
export function useBookingSlots(slug: string, serviceSlug: string | null, urgent: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['supplier-booking-slots', slug, serviceSlug, urgent],
    queryFn: () =>
      publicSupplierApi.getSlots(slug, { service: serviceSlug as string, days: urgent ? URGENT_WINDOW_DAYS : SLOT_WINDOW_DAYS, urgent: urgent || undefined }),
    enabled: enabled && !!slug && !!serviceSlug,
    staleTime: SLOTS_STALE_MS,
    retry: false,
  });
}

/** Holds the slot and e-mails the link. One call per attempt; the page keeps the id of the attempt and the answer. */
export function useCreateBookingHold(slug: string) {
  return useMutation({ mutationFn: (body: PublicBookingBody) => publicBookingApi.createHold(slug, body) });
}

/**
 * Checks the e-mail address with the token of the link. It is a query because it is idempotent by design (a second click answers
 * `alreadyConfirmed`) and because the page of the link may be drawn twice; it runs once, and again only while the card of a booking
 * paid inside CasaZen is not blocked yet.
 */
export function useBookingConfirmation(slug: string, holdId: string | null, token: string | null) {
  return useQuery({
    queryKey: ['supplier-booking-confirm', slug, holdId],
    queryFn: () => publicBookingApi.confirmEmail(slug, holdId as string, token as string),
    enabled: !!slug && !!holdId && !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => (query.state.status !== 'error' && query.state.data?.awaitingPayment ? AWAITING_PAYMENT_POLL_MS : false),
  });
}

export interface BookingRequestSession {
  access: PublicBookingAccess;
  view: PublicBookingView;
}

/**
 * The customer's own request ("La mia richiesta"): it finds the booking with the code and the e-mail and then acts on it, every call
 * answering the booking as it is after it. The code and the e-mail live **in memory only**, in this hook: not in the address, not in a
 * storage, not in the cache of the queries (which is why these are plain calls and not queries), so a shared phone keeps nothing.
 * When the server says the request moved under the customer (409), refused for what is true now (422) or took the time away, the page
 * reads the booking again so that what it shows is the truth.
 */
export function useBookingRequest(slug: string) {
  const [session, setSession] = useState<BookingRequestSession | null>(null);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [pending, setPending] = useState(false);

  const run = useCallback(async (call: () => Promise<PublicBookingView>, access: PublicBookingAccess): Promise<boolean> => {
    setPending(true);
    setFailure(null);
    try {
      setSession({ access, view: await call() });
      return true;
    } catch (error) {
      const found = readRequestFailure(error);
      setFailure(found);
      if (found.kind === 'changed' || found.kind === 'refused' || found.kind === 'slotTaken') {
        // What the page showed is not true any more: read it again, quietly.
        try {
          setSession({ access, view: await publicBookingApi.lookup(access) });
        } catch {
          // The failure above stays; the next try says more.
        }
      }
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const find = useCallback(
    (code: string, email: string) => {
      const access = { slug, code: code.trim(), email: email.trim() };
      return run(() => publicBookingApi.lookup(access), access);
    },
    [run, slug],
  );

  /** One action on the booking found: `call` gets the credentials and answers the booking. */
  const act = useCallback(
    (call: (access: PublicBookingAccess) => Promise<PublicBookingView>) => {
      if (!session) return Promise.resolve(false);
      return run(() => call(session.access), session.access);
    },
    [run, session],
  );

  const clearFailure = useCallback(() => setFailure(null), []);

  return { session, failure, pending, find, act, clearFailure };
}
