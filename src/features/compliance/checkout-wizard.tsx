import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCallback, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { WizardSummary } from '@/components/shared/wizard/wizard-summary';
import { getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
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
  type CheckoutWizardProgressCommand,
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
import { CheckoutGuestDataSubflow } from './components/checkout-guest-data-subflow';
import { channelManagerLinked } from './lib/checkout-result';

/**
 * Check-out of a stay (CO-08, CO-17, A5-24). The wizard is opened (`checkout-wizard/start`, same rules as
 * `POST /bookings/:id/check-out`) and has 5 steps: stay summary and departure, Alloggiati Web, cleaning request to a
 * supplier (or skip), tourist tax collected, property ready. It is a `WizardShell`: the step is in the address
 * (`?step=`), each step is checked before the next one opens, and the answers are kept as a draft in the session, so a
 * reload gives back what was typed. The answers are also saved on the server as the host lands on another step, so the
 * wizard resumes where it was, on the web or in the app. When the host never registered the arrival of a confirmed
 * booking the page offers "Registra arrivo e procedi" instead of a 409 dead end. When the stay is closed the wizard says
 * "What happens now"; after that the page shows what was declared and lets the host declare the property ready.
 *
 * There is no way out of the open wizard but "Save and exit" (E08/F04/US01, NF-45, NF-02): the guests' data that Alloggiati Web needs are completed in a
 * panel over the wizard, in the Alloggiati step and in the card of the arrival that was never registered, and the panel gives back the same step with its
 * answers. The pages that are not the wizard (the booking that cannot be loaded, the stay already closed, the check-out not available) keep their way back.
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
  // The panel that completes the guests' data from the card of the arrival that was never registered (the one of the Alloggiati step is the wizard's own).
  const [guestDataOpen, setGuestDataOpen] = useState(false);

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
        <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="checkout-wizard-page">
          <Breadcrumb />
          <CheckoutClosed bookingId={bookingId} />
          {backToBooking}
        </div>
      </AppShell>
    );
  }

  const arrivalMissing = booking.status === 'Confirmed' && hasStayStarted(booking);
  // The state of the wizard once it is open: the stay is checked in (or was closed in this visit) and the server has opened the wizard.
  const wizardState = arrivalRegistered || closedHere !== null ? start.data : undefined;
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
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="checkout-wizard-page">
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
              <GuestDataNotice bookingId={bookingId} inline onComplete={() => setGuestDataOpen(true)} busy={registerArrival.isPending} />
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
        {arrivalMissing && <CheckoutGuestDataSubflow bookingId={bookingId} open={guestDataOpen} onOpenChange={setGuestDataOpen} />}

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

        {wizardState && (
          <CheckoutWizardForm
            key={bookingId}
            bookingId={bookingId}
            guestName={guestName}
            state={wizardState}
            onClosed={setClosedHere}
            channelManager={channelManagerLinked(booking.octorateSync)}
          />
        )}

        {/* The way back is for the page that is not the wizard (loading, a start that failed, the arrival to register): the open wizard has "Save and exit". */}
        {!closedHere && !wizardState && (
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
function CheckoutStepPanel({
  step,
  state,
  onCompleteGuestData,
}: {
  step: CheckoutWizardStepId;
  state: CheckoutWizardState;
  onCompleteGuestData: () => void;
}) {
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
      return <AlloggiatiStep state={state} onCompleteGuestData={onCompleteGuestData} />;
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

interface SaveAndExitProps {
  bookingId: string;
  /** Saves the progress (the same call as the one that runs when the host lands on another step); it rejects when the server does not take it. */
  save: (command: CheckoutWizardProgressCommand) => Promise<unknown>;
  /** A request of the wizard is on its way (a save, the closing of the stay): the button stays off until it has answered. */
  busy: boolean;
  /** The host is leaving: told to the wizard, whose "Continue", last button, "Back" and list of steps stay off from the press until the save has answered. */
  onExiting: (exiting: boolean) => void;
}

/**
 * "Save and exit" (UX-06, AC-NF45-2): saves the answers as they stand, on the step the host is on, and only then leaves to the booking. It is the only way out
 * of the open wizard. When the server does not take the progress the host stays, with the answers, and the reason is on screen above the buttons (the
 * line of a progress that was not saved): leaving would lose what the wizard is there to keep.
 */
function SaveAndExit({ bookingId, save, busy, onExiting }: SaveAndExitProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getValues } = useFormContext<CheckoutAnswers>();
  const stepId = useOptionalWizard()?.stepId;

  const saveAndExit = async () => {
    if (busy || !stepId) return;
    onExiting(true);
    try {
      await save(progressCommand(getValues(), stepId as CheckoutWizardStepId));
    } catch {
      // Not saved: the host stays, the reason is on screen, and the wizard takes presses again.
      onExiting(false);
      return;
    }
    navigate(`/app/short-rent/bookings/${bookingId}`);
  };

  return (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        disabled={busy}
        loading={busy}
        onClick={() => void saveAndExit()}
        data-testid="checkout-save-exit"
      >
        {t('compliance.checkout.saveAndExit')}
      </Button>
    </div>
  );
}

/** The 5 steps of an open wizard, starting from the progress saved on the server. */
function CheckoutWizardForm({
  bookingId,
  guestName,
  state,
  onClosed,
  channelManager,
}: {
  bookingId: string;
  guestName: string;
  state: CheckoutWizardState;
  onClosed: (result: CheckoutWizardCompleteResult) => void;
  /** The booking is on the channel manager for sure: the result says one neutral thing about it. */
  channelManager: boolean;
}) {
  const { t } = useTranslation();
  const saveProgress = useSaveCheckoutProgress(bookingId);
  const completeCheckout = useCompleteCheckoutWizard(bookingId);
  const { mutate: saveProgressNow, mutateAsync: saveProgressAsync } = saveProgress;
  // The panel that completes the guests' data, over the wizard (opened from the Alloggiati step): it is not a step, so the answers and the step stay as they are.
  const [guestDataOpen, setGuestDataOpen] = useState(false);
  // "Save and exit" is on its way: "Continue", the last button, "Back" and the list of steps take no press meanwhile (a second request of the same wizard would race the save).
  const [exiting, setExiting] = useState(false);
  // The same, for the changes of step that still get through (a link of the summary, the address): they save no progress while the host is leaving. A ref, because the
  // function that is called on a change of step must not read the state of an earlier render.
  const exitingRef = useRef(false);
  const onExiting = useCallback((value: boolean) => {
    exitingRef.current = value;
    setExiting(value);
  }, []);

  const steps: WizardStep<CheckoutAnswers>[] = CHECKOUT_WIZARD_STEPS.map((stepId) => ({
    id: stepId,
    label: t(`compliance.checkout.steps.${stepId}.label`),
    title: t(`compliance.checkout.steps.${stepId}.title`),
    purpose: t(`compliance.checkout.steps.${stepId}.hint`),
    schema: checkoutStepSchemas[stepId],
    nextDisabled: exiting,
    render: () => <CheckoutStepPanel step={stepId} state={state} onCompleteGuestData={() => setGuestDataOpen(true)} />,
  }));

  /**
   * Lands on a step: the answers so far are saved, and the wizard reopens there, on the web or in the app. Not while "Save and exit" is saving the answers on the
   * step the host leaves from: a second save would race it, and the one that answers last would decide where the wizard reopens.
   */
  const onStepChange = useCallback(
    ({ to, values }: { to: string; values: CheckoutAnswers }) => {
      if (exitingRef.current) return;
      saveProgressNow(progressCommand(values, to as CheckoutWizardStepId));
    },
    [saveProgressNow]
  );

  return (
    <>
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
        navigationDisabled={exiting}
        // The server remembers the answers too, and so does the app: a draft of a step behind the one the server is on is older
        // than what the server knows, and would put old answers over newer ones.
        draft={{
          accept: (saved) =>
            CHECKOUT_WIZARD_STEPS.indexOf(saved.step as CheckoutWizardStepId) >= CHECKOUT_WIZARD_STEPS.indexOf(stepFromState(state)),
        }}
        // Reopening the confirmation (a typed address) when nothing was closed here: there is nothing to confirm, start over.
        renderDone={({ result }) =>
          result ? (
            <CheckoutDone bookingId={bookingId} guestName={guestName} result={result} channelManager={channelManager} />
          ) : (
            <Navigate to={{ search: '' }} replace />
          )
        }
        aboveFooter={
          saveProgress.isError ? (
            <p role="alert" className="text-sm text-destructive" data-testid="checkout-progress-error">
              {getProblemMessage(saveProgress.error, t) ?? t('compliance.checkout.progressSaveFailed')}
            </p>
          ) : undefined
        }
        // Where the link back to the booking was: under the bar of the buttons, after the wizard. Not above the bar, between the message of a refused closing and the
        // bar: on a phone the page scrolls that message in and the toast comes up over the room of the bar, and a button in between pushes the buttons into the toast.
        belowFooter={
          <SaveAndExit
            bookingId={bookingId}
            save={saveProgressAsync}
            busy={saveProgress.isPending || completeCheckout.isPending}
            onExiting={onExiting}
          />
        }
        testIds={{
          root: 'checkout-wizard-form',
          back: 'checkout-step-back',
          next: 'checkout-step-next',
          finish: 'checkout-complete-button',
          finishError: 'checkout-complete-error',
        }}
      />
      {/* Next to the wizard and not inside its form: the editor of the guests is a form of its own, and the events of a layer go up the tree of the page. */}
      <CheckoutGuestDataSubflow bookingId={bookingId} open={guestDataOpen} onOpenChange={setGuestDataOpen} />
    </>
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
