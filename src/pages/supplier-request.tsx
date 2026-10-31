import { useSearchParams } from 'react-router-dom';
import { ShowcaseBookingGate } from '@/components/supplier-site/booking-gate';
import { RequestGate } from '@/components/supplier-site/request/request-gate';
import { RequestView } from '@/components/supplier-site/request/request-view';
import { useSupplierSite } from '@/components/supplier-site/site-context';
import { useBookingRequest } from '@/queries/use-public-supplier-booking';
import '@/styles/supplier-site-booking.css';

function RequestArea() {
  const { model } = useSupplierSite();
  const [search] = useSearchParams();
  const request = useBookingRequest(model.slug);

  if (request.session) {
    return <RequestView view={request.session.view} failure={request.failure} pending={request.pending} act={request.act} />;
  }
  return <RequestGate initialCode={search.get('code') ?? ''} pending={request.pending} failure={request.failure} onFind={(code, email) => void request.find(code, email)} />;
}

/**
 * "La mia richiesta", `/fornitori/:slug/richiesta?code=XXXXX-XXXXX` (SP-12b): the page the links of the e-mails open. It asks for the
 * e-mail the booking was made with (the link carries only the code), finds the booking and shows where it is and what may be done. It
 * exists with the booking flag on, and stays open while the supplier has paused the site.
 */
export function SupplierRequestPage() {
  return (
    <ShowcaseBookingGate>
      <RequestArea />
    </ShowcaseBookingGate>
  );
}
