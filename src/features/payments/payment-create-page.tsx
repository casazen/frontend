import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreatePayment } from '@/queries/use-payments';
import { useBookings } from '@/queries/use-bookings';
import { paymentFormSchema } from './schemas/payment.schema';
import { getPaymentMethodLabel } from '@/lib/i18n-labels';
import type { PaymentFormValues } from './schemas/payment.schema';

const PAYMENT_METHODS = ['CreditCard', 'BankTransfer', 'PayPal', 'ApplePay', 'GooglePay'] as const;

export function PaymentCreatePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const createPayment = useCreatePayment();
  const { data: bookingsData } = useBookings();
  const bookings = bookingsData ?? [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      currency: 'EUR',
    } as any,
  });

  const onSubmit = async (data: PaymentFormValues) => {
    await createPayment.mutateAsync(data);
    navigate('/app/short-rent/payments');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('payment.create.title')}
          description={t('payment.create.description')}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('payment.create.paymentDetails')}</CardTitle>
              <CardDescription>{t('payment.create.paymentDetailsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bookingId">{t('payment.create.booking')}</Label>
                <select
                  id="bookingId"
                  {...register('bookingId')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t('payment.create.selectBooking')}</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.guest.firstName} {booking.guest.lastName} - {booking.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                {errors.bookingId && (
                  <p className="text-sm text-destructive">{errors.bookingId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">{t('payment.create.amount')}</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...register('amount', { valueAsNumber: true })}
                    placeholder={t('payment.create.amountPlaceholder')}
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">{t('payment.create.currency')}</Label>
                  <Input
                    id="currency"
                    {...register('currency')}
                    placeholder="EUR"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">{t('payment.create.paymentMethod')}</Label>
                <select
                  id="method"
                  {...register('method')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">{t('payment.create.selectMethod')}</option>
                  {PAYMENT_METHODS.map((value) => (
                    <option key={value} value={value}>
                      {getPaymentMethodLabel(value, t)}
                    </option>
                  ))}
                </select>
                {errors.method && (
                  <p className="text-sm text-destructive">{errors.method.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('payment.create.description')}</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder={t('payment.create.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/app/short-rent/payments')}>
              {t('payment.create.cancel')}
            </Button>
            <Button type="submit" disabled={createPayment.isPending}>
              {createPayment.isPending ? t('payment.create.creating') : t('payment.create.create')}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
