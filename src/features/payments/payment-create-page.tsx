import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { useBookings } from '@/queries/use-bookings';
import { cn } from '@/lib/utils';
import { RecordPaymentForm, type RecordPaymentOption } from './components/record-payment-form';
import { balanceOf, canRecordPayment } from './lib/record-payment';

/**
 * "Registra un incasso" (SR-06b): the host notes a payment received outside CasaZen, in cash or by bank transfer, on one of the
 * bookings it can be recorded on (not cancelled, not from a portal, which collects the money itself). It is recorded as collected, on
 * the day the host says, and never goes past what is left to collect. The list of bookings it depends on has its three states
 * (loading, error, empty) with `SkeletonCard`, `ErrorState` and `EmptyState`.
 */
export function PaymentCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const bookingsQuery = useBookings({ page: 1, pageSize: 100 });

  const options = useMemo<RecordPaymentOption[]>(
    () =>
      (bookingsQuery.data?.items ?? []).filter(canRecordPayment).map((booking) => ({
        id: booking.id,
        label: `${booking.guest.firstName} ${booking.guest.lastName} - ${booking.id.slice(0, 8)}`,
        balance: balanceOf(booking),
      })),
    [bookingsQuery.data],
  );
  const wanted = searchParams.get('bookingId') ?? undefined;
  const initialBookingId = options.some((option) => option.id === wanted) ? wanted : undefined;
  const backToList = () => navigate('/app/short-rent/payments');

  // A payment is recorded against a booking: while they load, when they fail to load and when there are none, the form
  // would be a dead end (an empty list is never shown as if nothing was wrong, A4-25).
  let body;
  if (bookingsQuery.isError) {
    body = (
      <ErrorState
        title={t('booking.list.loadError')}
        error={bookingsQuery.error}
        onRetry={() => void bookingsQuery.refetch()}
        showSupport
      />
    );
  } else if (bookingsQuery.isLoading) {
    body = <SkeletonCard lines={4} label={t('booking.list.loading')} />;
  } else if (options.length === 0) {
    body = (
      <EmptyState
        icon={Calendar}
        title={t('payment.create.noBookingsTitle')}
        description={t('payment.create.noBookingsDescription')}
        action={{ label: t('booking.list.newBooking'), href: '/app/short-rent/bookings/create' }}
      />
    );
  } else {
    body = (
      <Card className={cn(FOCUS_COLUMN)}>
        <CardHeader>
          <CardTitle>{t('payment.create.paymentDetails')}</CardTitle>
          <CardDescription>{t('payment.create.paymentDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RecordPaymentForm options={options} initialBookingId={initialBookingId} onRecorded={backToList} onCancel={backToList} />
        </CardContent>
      </Card>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('payment.create.title')} description={t('payment.create.description')} />

        {body}
      </div>
    </AppShell>
  );
}
