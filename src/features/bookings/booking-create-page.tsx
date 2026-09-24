import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { BookingForm } from './components/booking-form';
import { useCreateBooking } from '@/queries/use-bookings';
import { getProblemMessage } from '@/lib/api-errors';
import type { BookingFormValues } from './schemas/booking.schema';

export function BookingCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createBooking = useCreateBooking();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The booking is created Confirmed with source "Manual" (PC-01); a 409 means the dates overlap another booking
  // or a calendar block: the message stays next to the form until the next submit.
  const handleSubmit = async (data: BookingFormValues) => {
    setSubmitError(null);
    try {
      await createBooking.mutateAsync(data);
    } catch (error) {
      setSubmitError(getProblemMessage(error, t) ?? t('toast.bookingCreateFailed'));
      return;
    }
    navigate('/app/short-rent/bookings');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('booking.create.title')}
          description={t('booking.create.description')}
        />

        <BookingForm
          onSubmit={handleSubmit}
          isLoading={createBooking.isPending}
          submitError={submitError}
        />
      </div>
    </AppShell>
  );
}
