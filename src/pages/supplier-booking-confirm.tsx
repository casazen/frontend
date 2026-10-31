import { ShowcaseBookingGate } from '@/components/supplier-site/booking-gate';
import { BookingConfirmation } from '@/components/supplier-site/booking/booking-confirmation';
import '@/styles/supplier-site-booking.css';

/**
 * The page the link of the verification e-mail opens, `/fornitori/:slug/conferma` (SP-12b): it checks the address with the token of the
 * link and tells the customer its request is sent. It exists with the booking flag on. It stays reachable while the supplier has paused
 * the site: a customer who booked before the pause is answered all the same.
 */
export function SupplierBookingConfirmPage() {
  return (
    <ShowcaseBookingGate>
      <BookingConfirmation />
    </ShowcaseBookingGate>
  );
}
