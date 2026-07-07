import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { useBooking } from '@/queries/use-bookings';
import {
  useCompleteCheckoutWizard,
  useStartCheckoutWizard,
} from '@/features/compliance/use-compliance';
import type { CheckoutWizardStep } from '@/types/compliance.types';

const CHECKOUT_STEP_ORDER = [
  'confirm-departure',
  'compliance-summary',
  'supplier-selection',
  'payment',
  'property-ready',
] as const;

function checkoutStepIndex(stepId: string): number {
  return CHECKOUT_STEP_ORDER.indexOf(stepId as (typeof CHECKOUT_STEP_ORDER)[number]);
}

function CheckoutStepBar({ steps, currentStepId }: { steps: CheckoutWizardStep[]; currentStepId: string }) {
  const sorted = [...steps].sort((a, b) => checkoutStepIndex(a.id) - checkoutStepIndex(b.id));

  return (
    <div className="flex flex-wrap gap-2" data-testid="checkout-wizard-progress">
      {sorted.map((step) => {
        const isCurrent = step.id === currentStepId;
        return (
          <div
            key={step.id}
            data-testid={`checkout-step-${step.id}`}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              isCurrent ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground'
            }`}
          >
            {isCurrent ? (
              <Circle className="h-3.5 w-3.5 text-primary fill-primary/20" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CheckoutWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const bookingId = id!;

  const { data: booking, isLoading: bookingLoading } = useBooking(bookingId);
  const { data: wizard, isLoading: wizardLoading, isError: wizardError } = useStartCheckoutWizard(bookingId);
  const completeCheckout = useCompleteCheckoutWizard(bookingId);

  const [currentStepId, setCurrentStepId] = useState<string>('confirm-departure');
  const [confirmDeparture, setConfirmDeparture] = useState(false);
  const [supplierOrgId, setSupplierOrgId] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');

  if (bookingLoading || wizardLoading) {
    return <LoadingScreen message={t('compliance.checkout.loading')} />;
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

  if (wizardError || !wizard) {
    return (
      <AppShell>
        <div className="space-y-4 max-w-lg mx-auto py-12 text-center">
          <h2 className="text-xl font-semibold">{t('compliance.checkout.unavailable')}</h2>
          <p className="text-muted-foreground text-sm">{t('compliance.checkout.unavailableHint')}</p>
          <Button asChild>
            <Link to={`/app/short-rent/bookings/${bookingId}`}>{t('compliance.checkout.backToBooking')}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const currentIdx = checkoutStepIndex(currentStepId);
  const nextStepId = CHECKOUT_STEP_ORDER[currentIdx + 1];
  const currentStep = wizard.steps.find((s) => s.id === currentStepId) ?? wizard.steps[0];
  const suppliers = wizard.suppliers ?? [];

  const goNext = () => {
    if (nextStepId) setCurrentStepId(nextStepId);
  };

  const handleComplete = async () => {
    await completeCheckout.mutateAsync({
      confirmDeparture,
      supplierOrgId: supplierOrgId || null,
      serviceNotes: serviceNotes || null,
    });
    navigate(`/app/short-rent/bookings/${bookingId}`);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto" data-testid="checkout-wizard-page">
        <Breadcrumb />
        <PageHeader
          title={t('compliance.checkout.title')}
          description={t('compliance.checkout.description', {
            guest: `${booking.guest.firstName} ${booking.guest.lastName}`,
          })}
        />

        <CheckoutStepBar steps={wizard.steps} currentStepId={currentStepId} />

        <Card>
          <CardHeader>
            <CardTitle>{currentStep.label}</CardTitle>
            <CardDescription>{t(`compliance.checkout.steps.${currentStepId}`)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStepId === 'confirm-departure' && (
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
            )}

            {currentStepId === 'compliance-summary' && (
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>{t('compliance.checkout.summaryGuestData')}</li>
                <li>{t('compliance.checkout.summaryAlloggiati')}</li>
                <li>{t('compliance.checkout.summaryRetention')}</li>
              </ul>
            )}

            {currentStepId === 'supplier-selection' && (
              <div className="space-y-3" data-testid="checkout-supplier-picker">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t('compliance.checkout.supplierHint')}
                </p>
                {suppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('compliance.checkout.noSuppliers')}</p>
                ) : (
                  <div className="grid gap-2">
                    {suppliers.map((supplier) => (
                      <button
                        key={supplier.orgId}
                        type="button"
                        data-testid="checkout-supplier-option"
                        onClick={() => setSupplierOrgId(supplier.orgId)}
                        className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                          supplierOrgId === supplier.orgId ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                        }`}
                      >
                        <span className="font-medium">{supplier.legalName}</span>
                        {supplier.category && (
                          <Badge variant="secondary">{supplier.category}</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  <Label htmlFor="service-notes">{t('compliance.checkout.serviceNotes')}</Label>
                  <Textarea
                    id="service-notes"
                    value={serviceNotes}
                    onChange={(e) => setServiceNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {currentStepId === 'payment' && (
              <p className="text-sm text-muted-foreground">{t('compliance.checkout.paymentHint')}</p>
            )}

            {currentStepId === 'property-ready' && (
              <p className="text-sm">{t('compliance.checkout.propertyReadyHint')}</p>
            )}

            {currentStepId !== 'property-ready' && (
              <Button
                onClick={goNext}
                disabled={currentStepId === 'confirm-departure' && !confirmDeparture}
                data-testid="checkout-next-step"
              >
                {t('compliance.checkout.next')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link to={`/app/short-rent/bookings/${bookingId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('compliance.checkout.backToBooking')}
            </Link>
          </Button>
          {currentStepId === 'property-ready' && (
            <Button
              data-testid="checkout-complete-button"
              onClick={() => void handleComplete()}
              disabled={!confirmDeparture || completeCheckout.isPending}
            >
              {completeCheckout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('compliance.checkout.complete')}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
