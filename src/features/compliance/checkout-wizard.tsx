import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { useBooking } from '@/queries/use-bookings';
import { useCompleteCheckoutWizard } from '@/features/compliance/use-compliance';

function isCheckoutEligible(status: string): boolean {
  return status === 'CheckedIn';
}

export function CheckoutWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const bookingId = id!;

  const { data: booking, isLoading: bookingLoading, isError: bookingError } = useBooking(bookingId);
  const completeCheckout = useCompleteCheckoutWizard(bookingId);

  const [confirmDeparture, setConfirmDeparture] = useState(false);
  const [serviceNotes, setServiceNotes] = useState('');

  if (bookingLoading) {
    return <LoadingScreen message={t('compliance.checkout.loading')} />;
  }

  if (bookingError) {
    return (
      <AppShell>
        <div className="space-y-4 max-w-lg mx-auto py-12 text-center" data-testid="checkout-load-error">
          <h2 className="text-xl font-semibold">{t('compliance.checkout.loadError')}</h2>
          <p className="text-muted-foreground text-sm">{t('compliance.checkout.loadErrorHint')}</p>
          <Button asChild>
            <Link to="/app/short-rent/bookings">{t('compliance.checkout.backToBookings')}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!booking) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('compliance.checkout.notFound')}</h2>
        </div>
      </AppShell>
    );
  }

  const guestName = `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback');
  const alreadyDone = booking.status === 'CheckedOut';
  const canClose = isCheckoutEligible(booking.status);

  if (alreadyDone) {
    return (
      <AppShell>
        <div className="space-y-4 max-w-lg mx-auto py-12 text-center" data-testid="checkout-already-done">
          <h2 className="text-xl font-semibold">{t('compliance.checkout.alreadyDone')}</h2>
          <p className="text-muted-foreground text-sm">{t('compliance.checkout.alreadyDoneHint')}</p>
          <Button asChild>
            <Link to={`/app/short-rent/bookings/${bookingId}`}>{t('compliance.checkout.backToBooking')}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!canClose) {
    return (
      <AppShell>
        <div className="space-y-4 max-w-lg mx-auto py-12 text-center" data-testid="checkout-unavailable">
          <h2 className="text-xl font-semibold">{t('compliance.checkout.unavailable')}</h2>
          <p className="text-muted-foreground text-sm">{t('compliance.checkout.unavailableHint')}</p>
          <Button asChild>
            <Link to={`/app/short-rent/bookings/${bookingId}`}>{t('compliance.checkout.backToBooking')}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const handleComplete = async () => {
    try {
      await completeCheckout.mutateAsync({
        confirmDeparture: true,
        supplierOrgId: null,
        serviceNotes: serviceNotes || null,
      });
      navigate(`/app/short-rent/bookings/${bookingId}`);
    } catch {
      // Toast already shown by the mutation.
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-xl mx-auto" data-testid="checkout-wizard-page">
        <Breadcrumb />
        <PageHeader
          title={t('compliance.checkout.title')}
          description={t('compliance.checkout.description', { guest: guestName })}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('compliance.checkout.quickTitle')}</CardTitle>
            <CardDescription>{t('compliance.checkout.quickHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm-departure"
                data-testid="checkout-confirm-departure"
                checked={confirmDeparture}
                onCheckedChange={(checked) => setConfirmDeparture(checked === true)}
              />
              <Label htmlFor="confirm-departure" className="leading-relaxed">
                {t('compliance.checkout.confirmDepartureLabel')}
              </Label>
            </div>
            <div>
              <Label htmlFor="service-notes">{t('compliance.checkout.serviceNotesOptional')}</Label>
              <Textarea
                id="service-notes"
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
            <Button
              data-testid="checkout-complete-button"
              onClick={() => void handleComplete()}
              disabled={!confirmDeparture || completeCheckout.isPending}
            >
              {completeCheckout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('compliance.checkout.complete')}
            </Button>
          </CardContent>
        </Card>

        <Button variant="ghost" asChild>
          <Link to={`/app/short-rent/bookings/${bookingId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('compliance.checkout.backToBooking')}
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
