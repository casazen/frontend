import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { BookingForm } from './components/booking-form';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useBooking, useUpdateBooking } from '@/queries/use-bookings';
import type { BookingFormValues } from './schemas/booking.schema';

export function BookingEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: booking, isLoading } = useBooking(id!);
  const updateBooking = useUpdateBooking();

  const handleSubmit = async (data: BookingFormValues) => {
    if (id) {
      await updateBooking.mutateAsync({ id, data });
      navigate('/app/short-rent/bookings');
    }
  };

  if (isLoading) {
    return <LoadingScreen message={t('booking.edit.loading')} />;
  }

  if (!booking) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('booking.edit.notFound')}</h2>
          <p className="text-muted-foreground">{t('booking.edit.notFoundDescription')}</p>
        </div>
      </AppShell>
    );
  }

  const guestName = `${booking.guest.firstName} ${booking.guest.lastName}`;

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('booking.edit.title')}
          description={t('booking.edit.description', { name: guestName })}
        />

        <BookingForm
          booking={booking}
          onSubmit={handleSubmit}
          isLoading={updateBooking.isPending}
        />
      </div>
    </AppShell>
  );
}
