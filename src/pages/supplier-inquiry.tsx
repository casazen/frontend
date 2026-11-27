import { ShowcaseBookingGate } from '@/components/supplier-site/booking-gate';
import { InquiryForm } from '@/components/supplier-site/inquiry/inquiry-form';
import '@/styles/supplier-site-booking.css';
import '@/styles/supplier-site-inquiry.css';

export function SupplierInquiryPage() {
  return (
    <ShowcaseBookingGate>
      <InquiryForm />
    </ShowcaseBookingGate>
  );
}
