import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { BookingForm, type BookingFormSubmit } from './components/booking-form';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useBooking, useUpdateBooking } from '@/queries/use-bookings';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';

export function BookingEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: booking, isLoading, isError, error, refetch } = useBooking(id!);
  const updateBooking = useUpdateBooking();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const detailPath = `/app/short-rent/bookings/${id}`;

  // Only dates, guests and notes go to the API (PC-07, A2-07): status and prices are never sent. A 409 (dates taken)
  // or 422 (e.g. booking from the booking site) stays next to the form.
  const handleSubmit = async (data: BookingFormSubmit) => {
    if (!id) return;
    setSubmitError(null);
    try {
      await updateBooking.mutateAsync({
        id,
        data: {
          checkInDate: data.checkInDate,
          checkOutDate: data.checkOutDate,
          numberOfGuests: data.numberOfGuests,
          numberOfChildren: data.numberOfChildren,
          ...(data.childrenAges ? { childrenAges: data.childrenAges } : {}),
          specialRequests: data.specialRequests,
        },
      });
    } catch (err) {
      setSubmitError(getProblemMessage(err, t) ?? t('toast.bookingUpdateFailed'));
      return;
    }
    navigate(detailPath);
  };

  if (isLoading) {
    return <LoadingScreen message={t('booking.edit.loading')} />;
  }

  if (isError && getHttpStatus(error) !== 404) {
    return (
      <AppShell>
        <div className="text-center py-12 space-y-4" role="alert">
          <p className="text-destructive">{getProblemMessage(error, t) ?? t('booking.detailPage.loadError')}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            {t('booking.detailPage.retry')}
          </Button>
        </div>
      </AppShell>
    );
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

        {booking.status === 'Cancelled' ? (
          <div className="rounded-md border bg-muted/40 px-4 py-6 text-center space-y-3" data-testid="booking-not-editable">
            <p className="text-sm text-muted-foreground">{t('booking.edit.notEditable')}</p>
            <Link to={detailPath} className="text-primary hover:underline text-sm">
              {t('booking.edit.backToBooking')}
            </Link>
          </div>
        ) : (
          <BookingForm
            booking={booking}
            onSubmit={handleSubmit}
            onCancel={() => navigate(detailPath)}
            isLoading={updateBooking.isPending}
            submitError={submitError}
          />
        )}
      </div>
    </AppShell>
  );
}
