import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { WizardSummary } from '@/components/shared/wizard/wizard-summary';
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
import {
  CHECKOUT_WIZARD_STEPS,
  type CheckoutWizardCompleteResult,
  type CheckoutWizardState,
  type CheckoutWizardStepId,
} from '@/types/compliance.types';
import {
  answersFromState,
  checkoutStepSchemas,
  completeCommand,
  progressCommand,
  stepFromState,
  type CheckoutAnswers,
} from './checkout-wizard-model';
import {
  AlloggiatiStep,
  CleaningStep,
  PropertyReadyStep,
  StaySummaryStep,
  TouristTaxStep,
} from './components/checkout-wizard-steps';
import { CheckoutDone } from './components/checkout-wizard-done';

/**
 * Check-out of a stay (CO-08, CO-17, A5-24). The wizard is opened (`checkout-wizard/start`, same rules as
 * `POST /bookings/:id/check-out`) and has 5 steps: stay summary and departure, Alloggiati Web, cleaning request to a
 * supplier (or skip), tourist tax collected, property ready. It is a `WizardShell`: the step is in the address
 * (`?step=`), each step is checked before the next one opens, and the answers are kept as a draft in the session, so a
 * reload gives back what was typed. The answers are also saved on the server as the host lands on another step, so the
 * wizard resumes where it was, on the web or in the app. When the host never registered the arrival of a confirmed
 * booking the page offers "Registra arrivo e procedi" instead of a 409 dead end. When the stay is closed the wizard says
 * "What happens now"; after that the page shows what was declared and lets the host declare the property ready.
 */
export function CheckoutWizardPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const bookingId = id!;

  const { data: booking, isLoading: bookingLoading, isError: bookingError } = useBooking(bookingId);
  const arrivalRegistered = booking?.status === 'CheckedIn';
  const start = useStartCheckoutWizard(bookingId, arrivalRegistered);
  const registerArrival = useRegisterArrivalAndStartCheckout(bookingId);
  // Set when the host closes the stay in this visit: the booking becomes "checked out" at once, and the confirmation
  // "What happens now" must stay on screen instead of giving way to the summary of a closed stay.
  const [closedHere, setClosedHere] = useState<CheckoutWizardCompleteResult | null>(null);

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

  if (booking.status === 'CheckedOut' && !closedHere) {
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
  if (!closedHere && !arrivalRegistered && !arrivalMissing) {
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
      {/* `w-full`: the shell sits in a column; a centered block there takes the width of its content, and the buttons of a phone would stick out. */}
      <div className="space-y-6 max-w-2xl mx-auto w-full" data-testid="checkout-wizard-page">
        <Breadcrumb />
        <PageHeader
          title={t('compliance.checkout.title')}
          description={closedHere ? undefined : t('compliance.checkout.description', { guest: guestName })}
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

        {(arrivalRegistered || closedHere) && start.data && (
          <CheckoutWizardForm
            key={bookingId}
            bookingId={bookingId}
            guestName={guestName}
            state={start.data}
            onClosed={setClosedHere}
          />
        )}

        {!closedHere && (
          <Button variant="ghost" asChild>
            <Link to={`/app/short-rent/bookings/${bookingId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('compliance.checkout.backToBooking')}
            </Link>
          </Button>
        )}
      </div>
    </AppShell>
  );
}

/** The fields of one step: the step components, fed from the form of the wizard. */
function CheckoutStepPanel({ step, state }: { step: CheckoutWizardStepId; state: CheckoutWizardState }) {
  const form = useFormContext<CheckoutAnswers>();
  const answers = useWatch({ control: form.control }) as CheckoutAnswers;
  const change = useCallback(
    (update: Partial<CheckoutAnswers>) => {
      for (const [name, value] of Object.entries(update) as Array<[keyof CheckoutAnswers, CheckoutAnswers[keyof CheckoutAnswers]]>) {
        form.setValue(name, value as never, { shouldDirty: true });
      }
    },
    [form]
  );

  switch (step) {
    case 'stay-summary':
      return <StaySummaryStep state={state} draft={answers} onChange={change} />;
    case 'alloggiati':
      return <AlloggiatiStep state={state} />;
    case 'cleaning':
      return <CleaningStep state={state} draft={answers} onChange={change} />;
    case 'tourist-tax':
      return <TouristTaxStep state={state} draft={answers} onChange={change} />;
    case 'property-ready':
      return (
        <>
          <PropertyReadyStep draft={answers} onChange={change} />
          <CheckoutSummary answers={answers} />
        </>
      );
  }
}

/** What the host answered so far, before the last button: each answer links back to its step. */
function CheckoutSummary({ answers }: { answers: CheckoutAnswers }) {
  const { t } = useTranslation();
  const cleaning =
    answers.cleaningChoice === 'Request'
      ? t('compliance.checkout.summary.cleaningRequest')
      : answers.cleaningChoice === 'Skip'
        ? t('compliance.checkout.summary.cleaningSkip')
        : null;

  return (
    <section className="space-y-2" data-testid="checkout-summary">
      <h3 className="text-sm font-semibold">{t('compliance.checkout.summary.title')}</h3>
      <WizardSummary
        items={[
          {
            id: 'departure',
            label: t('compliance.checkout.summary.departure'),
            value: answers.departureConfirmed ? t('compliance.checkout.summary.departureConfirmed') : null,
            stepId: 'stay-summary',
          },
          { id: 'cleaning', label: t('compliance.checkout.summary.cleaning'), value: cleaning, stepId: 'cleaning' },
          {
            id: 'tourist-tax',
            label: t('compliance.checkout.summary.touristTax'),
            value: answers.touristTaxCollection ? t(`compliance.checkout.touristTax.collection.${answers.touristTaxCollection}`) : null,
            stepId: 'tourist-tax',
          },
        ]}
      />
    </section>
  );
}

/** The 5 steps of an open wizard, starting from the progress saved on the server. */
function CheckoutWizardForm({
  bookingId,
  guestName,
  state,
  onClosed,
}: {
  bookingId: string;
  guestName: string;
  state: CheckoutWizardState;
  onClosed: (result: CheckoutWizardCompleteResult) => void;
}) {
  const { t } = useTranslation();
  const saveProgress = useSaveCheckoutProgress(bookingId);
  const completeCheckout = useCompleteCheckoutWizard(bookingId);
  const { mutate: saveProgressNow } = saveProgress;

  const steps: WizardStep<CheckoutAnswers>[] = CHECKOUT_WIZARD_STEPS.map((stepId) => ({
    id: stepId,
    label: t(`compliance.checkout.steps.${stepId}.label`),
    title: t(`compliance.checkout.steps.${stepId}.title`),
    purpose: t(`compliance.checkout.steps.${stepId}.hint`),
    schema: checkoutStepSchemas[stepId],
    render: () => <CheckoutStepPanel step={stepId} state={state} />,
  }));

  /** Lands on a step: the answers so far are saved, and the wizard reopens there, on the web or in the app. */
  const onStepChange = useCallback(
    ({ to, values }: { to: string; values: CheckoutAnswers }) => saveProgressNow(progressCommand(values, to as CheckoutWizardStepId)),
    [saveProgressNow]
  );

  return (
    <WizardShell<CheckoutAnswers, CheckoutWizardCompleteResult>
      id={`checkout-${bookingId}`}
      steps={steps}
      defaultValues={answersFromState(state)}
      initialStepId={stepFromState(state)}
      finishLabel={t('compliance.checkout.complete')}
      finishFailedMessage={t('compliance.checkout.completeFailed')}
      onFinish={async (values) => {
        const result = await completeCheckout.mutateAsync(completeCommand(values));
        onClosed(result);
        return result;
      }}
      onStepChange={onStepChange}
      // The server remembers the answers too, and so does the app: a draft of a step behind the one the server is on is older
      // than what the server knows, and would put old answers over newer ones.
      draft={{
        accept: (saved) =>
          CHECKOUT_WIZARD_STEPS.indexOf(saved.step as CheckoutWizardStepId) >= CHECKOUT_WIZARD_STEPS.indexOf(stepFromState(state)),
      }}
      // Reopening the confirmation (a typed address) when nothing was closed here: there is nothing to confirm, start over.
      renderDone={({ result }) =>
        result ? <CheckoutDone bookingId={bookingId} guestName={guestName} result={result} /> : <Navigate to={{ search: '' }} replace />
      }
      aboveFooter={
        saveProgress.isError ? (
          <p role="alert" className="text-sm text-destructive" data-testid="checkout-progress-error">
            {getProblemMessage(saveProgress.error, t) ?? t('compliance.checkout.progressSaveFailed')}
          </p>
        ) : undefined
      }
      testIds={{
        root: 'checkout-wizard-form',
        back: 'checkout-step-back',
        next: 'checkout-step-next',
        finish: 'checkout-complete-button',
        finishError: 'checkout-complete-error',
      }}
    />
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
