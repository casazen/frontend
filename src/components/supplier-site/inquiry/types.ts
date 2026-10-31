import type { PublicBookingAccess, PublicBookingView } from '@/api/public-supplier-booking.api';
import type { RequestFailure } from '@/lib/supplier-site/request-errors';

/**
 * A call that does not disturb the page (see `useBookingRequest`): it gives the booking as it is after it, or the failure for the caller
 * to say where it belongs. The page above keeps the credentials; the components never see the e-mail.
 */
export type QuietCall = (call: (access: PublicBookingAccess) => Promise<PublicBookingView>) => Promise<{ ok: true } | { ok: false; failure: RequestFailure }>;

/** What of the supplier's site the request page needs and cannot read itself (it may be drawn without the frame of the site, as in tests). */
export interface InquirySiteInfo {
  /** The typical time to answer in minutes, measured; null until there are enough requests. */
  typicalResponseMinutes: number | null;
  /** The color of the buttons of the site, for the Payment Element (which lives in an iframe and cannot read the stylesheet). */
  buttonColor: string;
}
