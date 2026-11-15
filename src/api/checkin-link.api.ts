import type { CheckInLinkDelivery } from '@/types/checkin-link.types';
import { ApiClient } from './client';

/**
 * The delivery of the check-in link of a booking, host side (E23/F01/US02, NF-122). Reading asks `booking.read` on the property of the booking; the link
 * to copy comes back only for who also holds `booking.write`, which is the permission the endpoints that issue a link (`bookingsApi.createCheckInLink`,
 * `bookingsApi.resendCheckInLink`) ask. The answer is private (`Cache-Control: no-store`): it can hold the link, a secret that opens the page of the guest.
 */
export const checkinLinkApi = {
  /**
   * `GET /api/bookings/{id}/checkin/link-delivery`: the channel (`Email`, `PortalChat`, `Manual`), the state (`Sent`, `Sending`, a waiting state or `Failed`)
   * with its stable error code, and the link to copy. A booking with no delivery record answers 200 with `channel` and `state` empty; one of another
   * organization is a 404.
   */
  getDelivery: (bookingId: string) =>
    ApiClient.get<CheckInLinkDelivery>(`/bookings/${encodeURIComponent(bookingId)}/checkin/link-delivery`),
};
