import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { useCreatePayment } from '@/queries/use-payments';
import { useBookings } from '@/queries/use-bookings';
import { paymentFormSchema } from './schemas/payment.schema';
import { getPaymentMethodLabel } from '@/lib/i18n-labels';
import type { PaymentFormValues } from './schemas/payment.schema';

const PAYMENT_METHODS = ['CreditCard', 'BankTransfer', 'PayPal', 'ApplePay', 'GooglePay'] as const;

/**
 * Pilot page of the UI primitives (UI-02): the form uses `Field`, `Select`, `Alert` and `Button loading`, and the list of
 * bookings it depends on has its three states (loading, error, empty) with `SkeletonCard`, `ErrorState` and `EmptyState`.
 */
export function PaymentCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const createPayment = useCreatePayment();
  const { data: bookingsData } = useBookings({ page: 1, pageSize: 100 });
  const bookings = bookingsData?.items ?? [];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      currency: 'EUR',
    },
  });

  const selectedBookingId = watch('bookingId');
  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);
  const otaSources = new Set(['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda']);
  const isOta = selectedBooking?.source ? otaSources.has(selectedBooking.source) : false;

  const onSubmit = async (data: PaymentFormValues) => {
    await createPayment.mutateAsync(data);
    navigate('/app/short-rent/payments');
  };

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
  } else if (bookings.length === 0) {
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('payment.create.paymentDetails')}</CardTitle>
            <CardDescription>{t('payment.create.paymentDetailsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field id="bookingId" label={t('payment.create.booking')} error={errors.bookingId}>
              <Select {...register('bookingId')}>
                <option value="">{t('payment.create.selectBooking')}</option>
                {bookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.guest.firstName} {booking.guest.lastName} - {booking.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field id="amount" label={t('payment.create.amount')} error={errors.amount}>
                <Input
                  type="number"
                  step="0.01"
                  {...register('amount', { valueAsNumber: true })}
                  placeholder={t('payment.create.amountPlaceholder')}
                />
              </Field>

              <Field id="currency" label={t('payment.create.currency')}>
                <Input {...register('currency')} placeholder="EUR" />
              </Field>
            </div>

            <Field id="method" label={t('payment.create.paymentMethod')} error={errors.method}>
              <Select {...register('method')}>
                <option value="">{t('payment.create.selectMethod')}</option>
                {PAYMENT_METHODS.map((value) => (
                  <option key={value} value={value}>
                    {getPaymentMethodLabel(value, t)}
                  </option>
                ))}
              </Select>
            </Field>

            {isOta && (
              <Alert variant="info" data-testid="fiscal-ota-withholding-hint">
                {t('fiscal.page.description')}
              </Alert>
            )}

            <Field id="description" label={t('payment.create.description')} optional>
              <Textarea {...register('description')} placeholder={t('payment.create.descriptionPlaceholder')} rows={3} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/app/short-rent/payments')}>
            {t('payment.create.cancel')}
          </Button>
          <Button type="submit" loading={createPayment.isPending}>
            {createPayment.isPending ? t('payment.create.creating') : t('payment.create.create')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('payment.create.title')}
          description={t('payment.create.description')}
        />

        {body}
      </div>
    </AppShell>
  );
}
