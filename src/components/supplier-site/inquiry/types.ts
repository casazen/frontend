import type { PublicBookingAccess, PublicBookingView } from '@/api/public-supplier-booking.api';
import type { RequestFailure } from '@/lib/supplier-site/request-errors';

/**
 * A call that does not disturb the page (see `useBookingRequest`): it gives the booking as it is after it, or the failure for the caller
 * to say where it belongs. The page above keeps the credentials; the components never see the e-mail.
 */
export type QuietCall = (call: (access: PublicBookingAccess) => Promise<PublicBookingView>) => Promise<{ ok: true } | { ok: false; failure: RequestFailure }>;

export interface InquirySiteInfo {
  typicalResponseMinutes: number | null;
  buttonColor: string;
}
