import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { publicSupplierApi } from '@/api/public-supplier.api';
import { publicBookingApi, type PublicBookingAccess, type PublicBookingBody, type PublicBookingView } from '@/api/public-supplier-booking.api';
import { publicInquiryApi, type PublicInquiryBody } from '@/api/public-supplier-inquiry.api';
import { readRequestFailure, type RequestFailure } from '@/lib/supplier-site/request-errors';
import { viewSignature } from '@/lib/supplier-site/request-view';

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
  // `gcTime: 0`: the mutation (the body with the name, the e-mail and the phone, and the secret of the card in the answer) is not kept in the cache.
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

/** Sends the request on measure and e-mails the link. One call per attempt; the page keeps the id of the attempt and the answer. */
export function useCreateInquiry(slug: string) {
  // `gcTime: 0`: the mutation (the body with the words, the name, the e-mail and the phone) is not kept in the cache.
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

export interface BookingRequestSession {
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
  // What the customer did (an action or a message) and what is running: a quiet reading of the polling that started before one of them is
  // dropped, so a late answer never puts an older booking over a newer one.
  const calls = useRef({ started: 0, running: 0 });

  /** Shows the booking the server answered, keeping the card session of an offer whose card is still awaited. */
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
          // What the page showed is not true any more: read it again, quietly.
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

  /** One action on the booking found: `call` gets the credentials and answers the booking. */
  const act = useCallback(
    (call: (access: PublicBookingAccess) => Promise<PublicBookingView>) => {
      if (!session) return Promise.resolve(false);
      return run(() => call(session.access), session.access);
    },
    [run, session],
  );

  /**
   * One call that does not disturb the page: a message being written, the card being taken, the answer to an offer. No "working", no
   * line of failure: the caller gets the failure and says it where it belongs. The booking is read again when what it showed is not true
   * any more, as in {@link act}.
   */
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

  /**
   * Reads the booking again without a word, for the polling of a conversation. Gives what changed (see {@link viewSignature}) or null
   * when it asked nothing, failed, or was overtaken by something the customer did meanwhile.
   */
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
