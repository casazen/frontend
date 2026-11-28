import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { publicSupplierApi } from '@/api/public-supplier.api';
import { publicBookingApi, type PublicBookingAccess, type PublicBookingBody, type PublicBookingView } from '@/api/public-supplier-booking.api';
import { publicInquiryApi, type PublicInquiryBody } from '@/api/public-supplier-inquiry.api';
import { readRequestFailure, type RequestFailure } from '@/lib/supplier-site/request-errors';
import { viewSignature } from '@/lib/supplier-site/request-view';

const SLOTS_STALE_MS = 30_000;
const SLOT_WINDOW_DAYS = 28;
const URGENT_WINDOW_DAYS = 3;
const AWAITING_PAYMENT_POLL_MS = 4000;

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

export function useCreateBookingHold(slug: string) {
  return useMutation({ mutationFn: (body: PublicBookingBody) => publicBookingApi.createHold(slug, body), gcTime: 0 });
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

export function useCreateInquiry(slug: string) {
  return useMutation({ mutationFn: (body: PublicInquiryBody) => publicInquiryApi.create(slug, body), gcTime: 0 });
}

/**
 * Checks the e-mail address of a request on measure with the token of the link. Like the booking's, a query because it is idempotent by
 * design (a second click answers `alreadyConfirmed`) and because the page of the link may be drawn twice; it runs once.
 */
export function useInquiryConfirmation(slug: string, inquiryId: string | null, token: string | null) {
  return useQuery({
    queryKey: ['supplier-inquiry-confirm', slug, inquiryId],
    queryFn: () => publicInquiryApi.confirmEmail(slug, inquiryId as string, token as string),
    enabled: !!slug && !!inquiryId && !!token,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

interface BookingRequestSession {
  access: PublicBookingAccess;
  view: PublicBookingView;
}

/**
 * The card session of an accepted offer is a credential the server gives **only** in the answer of the acceptance. A reading or a message
 * that follows does not carry it, but the customer may be in the middle of typing a card: the session is kept for as long as the card is
 * awaited, and dropped as soon as it is not (the request was taken, the offer ended).
 */
function keepPaymentSession(next: PublicBookingView, previous: PublicBookingView | undefined): PublicBookingView {
  return next.negotiation === 'AwaitingPayment' && !next.paymentSession && previous?.paymentSession ? { ...next, paymentSession: previous.paymentSession } : next;
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
  const calls = useRef({ started: 0, running: 0 });

  const show = useCallback((access: PublicBookingAccess, view: PublicBookingView) => {
    setSession((previous) => ({ access, view: keepPaymentSession(view, previous?.view) }));
  }, []);

  const run = useCallback(
    async (call: () => Promise<PublicBookingView>, access: PublicBookingAccess): Promise<boolean> => {
      calls.current.started += 1;
      calls.current.running += 1;
      setPending(true);
      setFailure(null);
      try {
        show(access, await call());
        return true;
      } catch (error) {
        const found = readRequestFailure(error);
        setFailure(found);
        if (found.kind === 'changed' || found.kind === 'refused' || found.kind === 'slotTaken') {
          try {
            show(access, await publicBookingApi.lookup(access));
          } catch {
            // The failure above stays; the next try says more.
          }
        }
        return false;
      } finally {
        calls.current.running -= 1;
        setPending(false);
      }
    },
    [show],
  );

  const find = useCallback(
    (code: string, email: string) => {
      const access = { slug, code: code.trim(), email: email.trim() };
      return run(() => publicBookingApi.lookup(access), access);
    },
    [run, slug],
  );

  const act = useCallback(
    (call: (access: PublicBookingAccess) => Promise<PublicBookingView>) => {
      if (!session) return Promise.resolve(false);
      return run(() => call(session.access), session.access);
    },
    [run, session],
  );

  const quiet = useCallback(
    async (call: (access: PublicBookingAccess) => Promise<PublicBookingView>): Promise<{ ok: true } | { ok: false; failure: RequestFailure }> => {
      if (!session) return { ok: false, failure: { kind: 'other' } };
      const { access } = session;
      calls.current.started += 1;
      calls.current.running += 1;
      setFailure(null);
      try {
        show(access, await call(access));
        return { ok: true };
      } catch (error) {
        const found = readRequestFailure(error);
        if (found.kind === 'changed' || found.kind === 'refused' || found.kind === 'slotTaken') {
          try {
            show(access, await publicBookingApi.lookup(access));
          } catch {
            // The failure below says what happened; the next reading shows the rest.
          }
        }
        return { ok: false, failure: found };
      } finally {
        calls.current.running -= 1;
      }
    },
    [session, show],
  );

  const refresh = useCallback(async (): Promise<string | null> => {
    if (!session || calls.current.running > 0) return null;
    const { access } = session;
    const startedAt = calls.current.started;
    try {
      const view = await publicBookingApi.lookup(access);
      if (calls.current.started !== startedAt || calls.current.running > 0) return null;
      show(access, view);
      return viewSignature(view);
    } catch {
      return null;
    }
  }, [session, show]);

  const clearFailure = useCallback(() => setFailure(null), []);

  return { session, failure, pending, find, act, quiet, refresh, clearFailure };
}
