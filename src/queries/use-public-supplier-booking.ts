import { useMutation, useQuery } from '@tanstack/react-query';
import { publicSupplierApi } from '@/api/public-supplier.api';
import { publicBookingApi, type PublicBookingBody } from '@/api/public-supplier-booking.api';

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
