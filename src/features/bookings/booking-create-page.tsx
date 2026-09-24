import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { BookingForm, type BookingFormSubmit } from './components/booking-form';
import { useCreateBooking } from '@/queries/use-bookings';
import { getProblemMessage } from '@/lib/api-errors';

const BOOKINGS_PATH = '/app/short-rent/bookings';

export function BookingCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Opened from a property ("New booking" on the property page or on its filtered list): the property is preselected.
  const propertyId = searchParams.get('propertyId') ?? undefined;
  const createBooking = useCreateBooking();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The booking is created Confirmed with source "Manual" (PC-01); a 409 means the dates overlap another booking
  // or a calendar block: the message stays next to the form until the next submit.
  const handleSubmit = async (data: BookingFormSubmit) => {
    setSubmitError(null);
    try {
      await createBooking.mutateAsync({
        propertyId: data.propertyId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        numberOfGuests: data.numberOfGuests,
        numberOfChildren: data.numberOfChildren,
        ...(data.childrenAges ? { childrenAges: data.childrenAges } : {}),
        guest: data.guest!,
        specialRequests: data.specialRequests,
      });
    } catch (error) {
      setSubmitError(getProblemMessage(error, t) ?? t('toast.bookingCreateFailed'));
      return;
    }
    navigate(propertyId ? `${BOOKINGS_PATH}?propertyId=${encodeURIComponent(propertyId)}` : BOOKINGS_PATH);
  };

  const handleCancel = () =>
    navigate(propertyId ? `/app/short-rent/properties/${encodeURIComponent(propertyId)}` : BOOKINGS_PATH);

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('booking.create.title')}
          description={t('booking.create.description')}
        />

        <BookingForm
          initialPropertyId={propertyId}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={createBooking.isPending}
          submitError={submitError}
        />
      </div>
    </AppShell>
  );
}
