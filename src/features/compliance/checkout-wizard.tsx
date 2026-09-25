import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useBooking } from '@/queries/use-bookings';
import {
  useCheckoutWizard,
  useCompleteCheckoutWizard,
  useConfirmPropertyReady,
  useRegisterArrivalAndStartCheckout,
  useSaveCheckoutProgress,
  useStartCheckoutWizard,
} from '@/features/compliance/use-compliance';
import { GuestDataNotice } from '@/features/bookings/components/guest-data-notice';
import { hasStayStarted } from '@/features/bookings/lib/stay-actions';
import { CHECKOUT_WIZARD_STEPS, type CheckoutWizardState, type CheckoutWizardStepId } from '@/types/compliance.types';
import {
  canComplete,
  completeCommand,
  draftFromState,
  isStepAnswered,
  progressCommand,
  stepIndex,
  type CheckoutDraft,
} from './checkout-wizard-model';
import {
  AlloggiatiStep,
  CheckoutStepper,
  CleaningStep,
  PropertyReadyStep,
  StaySummaryStep,
  TouristTaxStep,
} from './components/checkout-wizard-steps';

/**
 * Check-out of a stay (CO-08, CO-17, A5-24). The wizard is opened (`checkout-wizard/start`, same rules as
 * `POST /bookings/:id/check-out`) and has 5 steps: stay summary and departure, Alloggiati Web, cleaning request to a
 * supplier (or skip), tourist tax collected, property ready. Every step can be reopened and the answers are saved on the
 * server as the host moves, so the wizard resumes where it was. When the host never registered the arrival of a
 * confirmed booking the page offers "Registra arrivo e procedi" instead of a 409 dead end. After the check-out the page
 * shows what was declared and lets the host declare the property ready.
 */
export function CheckoutWizardPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const bookingId = id!;

  const { data: booking, isLoading: bookingLoading, isError: bookingError } = useBooking(bookingId);
  const arrivalRegistered = booking?.status === 'CheckedIn';
  const start = useStartCheckoutWizard(bookingId, arrivalRegistered);
  const registerArrival = useRegisterArrivalAndStartCheckout(bookingId);

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
  const backToBooking = (
    <Button asChild>
      <Link to={`/app/short-rent/bookings/${bookingId}`}>{t('compliance.checkout.backToBooking')}</Link>
    </Button>
  );

  if (booking.status === 'CheckedOut') {
    return (
      <AppShell>
        <div className="space-y-6 max-w-xl mx-auto" data-testid="checkout-wizard-page">
          <Breadcrumb />
          <CheckoutClosed bookingId={bookingId} />
          {backToBooking}
        </div>
      </AppShell>
    );
  }

  const arrivalMissing = booking.status === 'Confirmed' && hasStayStarted(booking);
  if (!arrivalRegistered && !arrivalMissing) {
    return (
      <AppShell>
        <div className="space-y-4 max-w-lg mx-auto py-12 text-center" data-testid="checkout-unavailable">
          <h2 className="text-xl font-semibold">{t('compliance.checkout.unavailable')}</h2>
          <p className="text-muted-foreground text-sm">{t('compliance.checkout.unavailableHint')}</p>
          {backToBooking}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl mx-auto" data-testid="checkout-wizard-page">
        <Breadcrumb />
        <PageHeader
          title={t('compliance.checkout.title')}
          description={t('compliance.checkout.description', { guest: guestName })}
        />

        {arrivalMissing && (
          <Card data-testid="checkout-arrival-missing">
            <CardHeader>
              <CardTitle>{t('compliance.checkout.arrivalMissingTitle')}</CardTitle>
              <CardDescription>{t('compliance.checkout.arrivalMissingHint', { guest: guestName })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GuestDataNotice bookingId={bookingId} />
              {registerArrival.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {getProblemMessage(registerArrival.error, t) ?? t('compliance.checkout.startFailed')}
                </p>
              )}
              <Button
                data-testid="checkout-register-arrival"
                onClick={() => registerArrival.mutate()}
                disabled={registerArrival.isPending}
              >
                {registerArrival.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {registerArrival.isPending
                  ? t('compliance.checkout.registeringArrival')
                  : t('compliance.checkout.registerArrivalAndProceed')}
              </Button>
            </CardContent>
          </Card>
        )}

        {arrivalRegistered && start.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="checkout-starting">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('compliance.checkout.starting')}
          </p>
        )}

        {arrivalRegistered && start.isError && (
          <div className="space-y-3" data-testid="checkout-start-error">
            <p role="alert" className="text-sm text-destructive">
              {getProblemMessage(start.error, t) ?? t('compliance.checkout.startFailed')}
            </p>
            <Button variant="outline" size="sm" onClick={() => void start.refetch()}>
              {t('compliance.checkout.retry')}
            </Button>
          </div>
        )}

        {arrivalRegistered && start.data && <CheckoutWizardForm key={bookingId} bookingId={bookingId} state={start.data} />}

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

/** The 5 steps of an open wizard, starting from the progress saved on the server. */
function CheckoutWizardForm({ bookingId, state }: { bookingId: string; state: CheckoutWizardState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<CheckoutDraft>(() => draftFromState(state));
  const saveProgress = useSaveCheckoutProgress(bookingId);
  const completeCheckout = useCompleteCheckoutWizard(bookingId);

  const change = (update: Partial<CheckoutDraft>) => setDraft((current) => ({ ...current, ...update }));

  /** Moves to `step` and saves the answers so far: the wizard reopens there, on the web or in the app. */
  const goTo = (step: CheckoutWizardStepId) => {
    change({ step });
    saveProgress.mutate(progressCommand(draft, step));
  };

  const index = stepIndex(draft.step);
  const previous = index > 0 ? CHECKOUT_WIZARD_STEPS[index - 1] : null;
  const next = index < CHECKOUT_WIZARD_STEPS.length - 1 ? CHECKOUT_WIZARD_STEPS[index + 1] : null;
  const answered = isStepAnswered(draft, draft.step);

  const handleComplete = async () => {
    try {
      await completeCheckout.mutateAsync(completeCommand(draft));
      navigate(`/app/short-rent/bookings/${bookingId}`);
    } catch {
      // Shown below and by the mutation toast.
    }
  };

  return (
    <Card data-testid="checkout-wizard-form" data-step={draft.step}>
      <CardHeader className="space-y-4">
        <CheckoutStepper draft={draft} onSelect={goTo} />
        <div>
          <CardTitle>{t(`compliance.checkout.steps.${draft.step}.title`)}</CardTitle>
          <CardDescription>{t(`compliance.checkout.steps.${draft.step}.hint`)}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {draft.step === 'stay-summary' && <StaySummaryStep state={state} draft={draft} onChange={change} />}
        {draft.step === 'alloggiati' && <AlloggiatiStep state={state} />}
        {draft.step === 'cleaning' && <CleaningStep state={state} draft={draft} onChange={change} />}
        {draft.step === 'tourist-tax' && <TouristTaxStep state={state} draft={draft} onChange={change} />}
        {draft.step === 'property-ready' && <PropertyReadyStep draft={draft} onChange={change} />}

        {saveProgress.isError && (
          <p role="alert" className="text-sm text-destructive" data-testid="checkout-progress-error">
            {getProblemMessage(saveProgress.error, t) ?? t('compliance.checkout.progressSaveFailed')}
          </p>
        )}
        {completeCheckout.isError && (
          <p role="alert" className="text-sm text-destructive" data-testid="checkout-complete-error">
            {getProblemMessage(completeCheckout.error, t) ?? t('compliance.checkout.completeFailed')}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="checkout-step-back"
            disabled={!previous}
            onClick={() => previous && goTo(previous)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('compliance.checkout.back')}
          </Button>
          {next ? (
            <Button type="button" data-testid="checkout-step-next" disabled={!answered} onClick={() => goTo(next)}>
              {t('compliance.checkout.next')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="checkout-complete-button"
              onClick={() => void handleComplete()}
              disabled={!canComplete(draft) || completeCheckout.isPending}
            >
              {completeCheckout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('compliance.checkout.complete')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** After the check-out: what the host declared and, while the property is not ready, the declaration "ready". */
function CheckoutClosed({ bookingId }: { bookingId: string }) {
  const { t, i18n } = useTranslation();
  const wizard = useCheckoutWizard(bookingId);
  const confirmReady = useConfirmPropertyReady(bookingId);
  const [notes, setNotes] = useState('');
  const state = wizard.data;

  return (
    <Card data-testid="checkout-already-done">
      <CardHeader>
        <CardTitle>{t('compliance.checkout.alreadyDone')}</CardTitle>
        <CardDescription>{t('compliance.checkout.alreadyDoneHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {wizard.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('compliance.checkout.loading')}
          </p>
        )}
        {wizard.isError && (
          <div className="space-y-2" data-testid="checkout-closed-error">
            <p role="alert" className="text-sm text-destructive">
              {getProblemMessage(wizard.error, t) ?? t('compliance.checkout.closedLoadError')}
            </p>
            <Button variant="outline" size="sm" onClick={() => void wizard.refetch()}>
              {t('compliance.checkout.retry')}
            </Button>
          </div>
        )}
        {state && (
          <>
            <ul className="space-y-1 text-sm" data-testid="checkout-closed-summary">
              <li data-testid="checkout-closed-cleaning">
                {state.cleaning.requestId
                  ? t('compliance.checkout.closed.cleaningRequested')
                  : state.cleaning.choice === 'Skip'
                    ? t('compliance.checkout.closed.cleaningSkipped')
                    : t('compliance.checkout.closed.cleaningNone')}
              </li>
              <li data-testid="checkout-closed-tourist-tax">
                {state.touristTax.collection
                  ? t(`compliance.checkout.touristTax.collection.${state.touristTax.collection}`)
                  : t('compliance.checkout.closed.touristTaxNotDeclared')}
              </li>
            </ul>
            {state.propertyReady.readyAt ? (
              <p className="flex items-center gap-2 text-sm text-green-700" data-testid="checkout-closed-property-ready">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {t('compliance.checkout.closed.propertyReady', {
                  date: formatRomeDateTime(state.propertyReady.readyAt, i18n.language),
                })}
              </p>
            ) : (
              <div className="space-y-3 rounded-md border p-4" data-testid="checkout-closed-property-not-ready">
                <p className="text-sm font-medium">{t('compliance.checkout.closed.propertyNotReady')}</p>
                <div className="space-y-2">
                  <Label htmlFor="checkout-ready-notes">{t('compliance.checkout.propertyReady.notes')}</Label>
                  <Textarea
                    id="checkout-ready-notes"
                    value={notes}
                    maxLength={1000}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <Button
                  type="button"
                  data-testid="checkout-confirm-property-ready"
                  disabled={confirmReady.isPending}
                  onClick={() => confirmReady.mutate(notes.trim() || null)}
                >
                  {confirmReady.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('compliance.checkout.closed.confirmReady')}
                </Button>
                {confirmReady.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {getProblemMessage(confirmReady.error, t) ?? t('compliance.checkout.propertyReadyFailed')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
