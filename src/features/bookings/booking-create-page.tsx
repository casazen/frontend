import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { BookingForm } from './components/booking-form';
import { useCreateBooking } from '@/queries/use-bookings';
import type { BookingFormValues } from './schemas/booking.schema';

export function BookingCreatePage() {
  const navigate = useNavigate();
  const createBooking = useCreateBooking();

  const handleSubmit = async (data: BookingFormValues) => {
    await createBooking.mutateAsync(data);
    navigate('/bookings');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Create Booking"
          description="Create a new booking reservation"
        />

        <BookingForm onSubmit={handleSubmit} isLoading={createBooking.isPending} />
      </div>
    </AppShell>
  );
}
