import { ShowcaseBookingGate } from '@/components/supplier-site/booking-gate';
import { BookingConfirmation } from '@/components/supplier-site/booking/booking-confirmation';
import '@/styles/supplier-site-booking.css';

export function SupplierBookingConfirmPage() {
  return (
    <ShowcaseBookingGate>
      <BookingConfirmation />
    </ShowcaseBookingGate>
  );
}
