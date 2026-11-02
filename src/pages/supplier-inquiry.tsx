import { ShowcaseBookingGate } from '@/components/supplier-site/booking-gate';
import { InquiryForm } from '@/components/supplier-site/inquiry/inquiry-form';
import '@/styles/supplier-site-booking.css';
import '@/styles/supplier-site-inquiry.css';

/**
 * The request on measure, `/fornitori/:slug/preventivo` (SP-12c): the page that "Richiesta su misura" on the site leads to, for what the
 * price list does not say or says with variations. It exists with the booking flag on (with it off the address leads back to the home of
 * the site) and, like the rest of the site, shows the page "paused" while the supplier has paused it: a paused site takes no new request.
 */
export function SupplierInquiryPage() {
  return (
    <ShowcaseBookingGate>
      <InquiryForm />
    </ShowcaseBookingGate>
  );
}
