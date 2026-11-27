import { useQuery } from '@tanstack/react-query';
import { checkinLinkApi } from '@/api/checkin-link.api';
import { retryTransientErrors } from '@/lib/query-client';
import type { CheckInLinkDelivery } from '@/types/checkin-link.types';

export const CHECKIN_LINK_DELIVERY_KEY = 'checkin-link-delivery';

const CHECKIN_LINK_DELIVERY_POLL_MS = 60_000;

const ON_ITS_WAY: ReadonlySet<string> = new Set(['Sending', 'WaitingChatPermission', 'WaitingThread', 'WaitingContact', 'WaitingStaticIps']);

function isOnItsWay(delivery: CheckInLinkDelivery | undefined): boolean {
  return delivery !== undefined && !delivery.ended && delivery.state != null && ON_ITS_WAY.has(delivery.state);
}

/**
 * Where the check-in link of a booking stands on its way to the guest (`GET /api/bookings/{id}/checkin/link-delivery`, NF-122). It is read again every
 * time the panel opens, on return to the window, when the bell announces that a link failed (`use-notifications-realtime`) and every minute while the link
 * is still on its way. The answer can hold the link to the page of the guest, a secret: it is kept in no list, and not at all once the panel is closed
 * (`gcTime: 0`). `enabled` is false while the flags of the feature are off: nothing is asked then.
 */
export function useCheckInLinkDelivery(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: [CHECKIN_LINK_DELIVERY_KEY, bookingId],
    queryFn: () => checkinLinkApi.getDelivery(bookingId),
    enabled: enabled && Boolean(bookingId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    gcTime: 0,
    refetchInterval: (query) => (isOnItsWay(query.state.data) ? CHECKIN_LINK_DELIVERY_POLL_MS : false),
    retry: retryTransientErrors(1),
  });
}
