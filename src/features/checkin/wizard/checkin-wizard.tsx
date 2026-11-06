import { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useFormContext } from 'react-hook-form';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { Breadcrumb } from '@/components/shared/breadcrumb';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HelpTip } from '@/components/ui/help-tip';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { formatStayDate } from '@/lib/stay-dates';
import { useCheckInWizardState, useConfirmCheckIn, useMarkNoShow, useSaveCheckInGuests } from '@/queries/use-checkin-wizard';
import type { CheckInConfirmation, CheckInWizardState } from '@/types/checkin-wizard.types';
import {
  CHECKIN_NOT_READY_CODE,
  FOCUS_PARAM,
  documentsReadyToSave,
  documentsStepSchema,
  guestsSignature,
  guestsStepSchema,
  initialStepOf,
  statisticalFieldsOf,
  stepOfGuestField,
  toGuestsPayload,
  wizardValuesFromState,
  type CheckInWizardStepId,
  type CheckInWizardValues,
} from './lib/checkin-wizard-model';
import { applyGuestFieldProblems, guestFieldProblemsOf, type GuestFieldProblem } from './lib/guest-save-errors';
import { useHostCodeSource } from './lib/use-host-code-source';
import { CheckInWizardDone } from './steps/checkin-wizard-done';
import { ChecksStep } from './steps/checks-step';
import { DocumentsStep } from './steps/documents-step';
import { GuestsStep } from './steps/guests-step';
import { SendStep } from './steps/send-step';
import { TaxStep } from './steps/tax-step';

/** The page of a booking: where "Save and exit" and the no-show leave to. */
function stayPath(bookingId: string): string {
  return `${BOOKINGS_PATH}/${bookingId}`;
}

/**
 * Puts the problems the server found in the data of the guests on the fields of the form of the wizard (the form is where this is rendered).
 * A refused save opens the step the field is on, and the shell clears the errors of the form each time the step changes, in the same pass as
 * this effect: so the problems are put on the fields once that pass is over, and again at every change of step.
 */
function ApplyFieldProblems({ problems }: { problems: readonly GuestFieldProblem[] }) {
  const { setError } = useFormContext<CheckInWizardValues>();
  const stepId = useOptionalWizard()?.stepId;
  useEffect(() => {
    if (problems.length === 0) return undefined;
    let current = true;
    queueMicrotask(() => {
      if (current) applyGuestFieldProblems(problems, setError);
    });
    return () => {
      current = false;
    };
  }, [problems, setError, stepId]);
  return null;
}

interface SaveAndExitProps {
  onSaveAndExit: (values: CheckInWizardValues) => Promise<void>;
  busy: boolean;
  problem: string | null;
}

/** "Save and exit" (NF-06): saves what the current step owns with the same call as "Continue", then leaves to the booking. On every step. */
function SaveAndExit({ onSaveAndExit, busy, problem }: SaveAndExitProps) {
  const { t } = useTranslation();
  const { getValues } = useFormContext<CheckInWizardValues>();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        loading={busy}
        onClick={() => void onSaveAndExit(getValues())}
        data-testid="checkin-wizard-save-exit"
      >
        {t('checkin.wizard.saveExit')}
      </Button>
      {problem && (
        <p role="alert" className="text-right text-sm text-destructive" data-testid="checkin-wizard-save-exit-problem">
          {problem}
        </p>
      )}
    </div>
  );
}

/** The question mark of a step: what the step is for, in two sentences (UI-07). */
function StepHelp({ step }: { step: CheckInWizardStepId }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end">
      <HelpTip title={t(`checkin.wizard.steps.${step}.title`)}>{t(`checkin.wizard.steps.${step}.help`)}</HelpTip>
    </div>
  );
}

interface NoShowActionProps {
  bookingId: string;
}

/** "The guest did not arrive" (NF-45): asks for a confirmation, marks the stay as a no-show and leaves to the booking. */
function NoShowAction({ bookingId }: NoShowActionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const noShow = useMarkNoShow(bookingId);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const confirm = async () => {
    setProblem(null);
    try {
      await noShow.mutateAsync();
      setOpen(false);
      navigate(stayPath(bookingId));
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t('checkin.wizard.noShow.failed'));
    }
  };

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)} data-testid="checkin-wizard-no-show">
        {t('checkin.wizard.noShow.button')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (noShow.isPending) return;
          setOpen(next);
          if (!next) setProblem(null);
        }}
      >
        <DialogContent data-testid="checkin-wizard-no-show-dialog">
          <DialogHeader>
            <DialogTitle>{t('checkin.wizard.noShow.title')}</DialogTitle>
            <DialogDescription>{t('checkin.wizard.noShow.description')}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm" aria-label={t('checkin.wizard.noShow.consequences')}>
            <li>{t('checkin.wizard.noShow.consequenceMark')}</li>
            <li>{t('checkin.wizard.noShow.consequencePolice')}</li>
            <li>{t('checkin.wizard.noShow.consequenceLate')}</li>
          </ul>
          {problem && (
            <p role="alert" className="text-sm text-destructive" data-testid="checkin-wizard-no-show-problem">
              {problem}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={noShow.isPending}>
              {t('checkin.wizard.noShow.cancel')}
            </Button>
            <Button type="button" onClick={() => void confirm()} loading={noShow.isPending} data-testid="checkin-wizard-no-show-confirm">
              {t('checkin.wizard.noShow.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface CheckInWizardFormProps {
  bookingId: string;
  state: CheckInWizardState;
}

/** The five steps of an open wizard, on the state the server gave when it opened. */
function CheckInWizardForm({ bookingId, state }: CheckInWizardFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const wizard = useCheckInWizardState(bookingId, true, false);
  const save = useSaveCheckInGuests(bookingId);
  const confirm = useConfirmCheckIn(bookingId);
  const source = useHostCodeSource(bookingId);

  // What the steps show is the latest state (each save answers with the new one); the form starts from the one the wizard opened with.
  const latest = wizard.data ?? state;
  const statisticalFields = useMemo(() => statisticalFieldsOf(state), [state]);
  const [initialValues] = useState(() => wizardValuesFromState(state));
  // What the server holds, as the text of the request that saved it: a step saves only when the host changed something since.
  const [savedSignature, setSavedSignature] = useState(() => guestsSignature(initialValues, statisticalFields));
  const [fieldProblems, setFieldProblems] = useState<GuestFieldProblem[]>([]);
  const [exitProblem, setExitProblem] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  const blocking = latest.issues.filter((issue) => issue.blocking).length;
  const warnings = latest.issues.length - blocking;
  const isUnchanged = (values: CheckInWizardValues) => guestsSignature(values, statisticalFields) === savedSignature;

  /**
   * Saves the guests when the host changed something (the same call for "Continue" and "Save and exit"). The guests step defers the save
   * while a document is still to type: the server saves no head without it, and the next step asks for it. A refused save puts its field
   * errors on the fields and opens the step they are on.
   */
  const saveGuests = async (stepId: 'guests' | 'documents', values: CheckInWizardValues): Promise<void> => {
    if (isUnchanged(values)) return;
    if (stepId === 'guests' && !documentsReadyToSave(values)) return;
    setFieldProblems([]);
    try {
      await save.mutateAsync(toGuestsPayload(values, statisticalFields));
      setSavedSignature(guestsSignature(values, statisticalFields));
    } catch (error) {
      const problems = guestFieldProblemsOf(error, values.guests.length, t('checkin.validation.invalidValue'));
      setFieldProblems(problems);
      const first = problems[0];
      if (first && stepOfGuestField(first.field) !== stepId) {
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          next.set('step', stepOfGuestField(first.field));
          next.set(FOCUS_PARAM, `guest-${first.guestIndex}-${first.field}`);
          return next;
        });
      }
      throw error;
    }
  };

  const saveAndExit = async (values: CheckInWizardValues): Promise<void> => {
    setExitProblem(null);
    if (!isUnchanged(values)) {
      const complete = guestsStepSchema(statisticalFields).safeParse(values).success && documentsReadyToSave(values);
      if (!complete) {
        setExitProblem(t('checkin.wizard.exitIncomplete'));
        return;
      }
      setExiting(true);
      try {
        await saveGuests('documents', values);
      } catch (error) {
        setExitProblem(getProblemMessage(error, t) ?? t('checkin.wizard.guests.saveFailed'));
        return;
      } finally {
        setExiting(false);
      }
    }
    navigate(stayPath(bookingId));
  };

  const stepText = (id: CheckInWizardStepId) => ({
    label: t(`checkin.wizard.steps.${id}.label`),
    title: t(`checkin.wizard.steps.${id}.title`),
    purpose: t(`checkin.wizard.steps.${id}.purpose`),
  });

  const steps: WizardStep<CheckInWizardValues>[] = [
    {
      id: 'guests',
      ...stepText('guests'),
      schema: guestsStepSchema(statisticalFields),
      beforeNext: (values) => saveGuests('guests', values),
      render: ({ form }) => (
        <>
          <StepHelp step="guests" />
          <GuestsStep bookingId={bookingId} form={form} />
        </>
      ),
    },
    {
      id: 'documents',
      ...stepText('documents'),
      schema: documentsStepSchema(isUnchanged),
      beforeNext: (values) => saveGuests('documents', values),
      render: ({ form }) => (
        <>
          <StepHelp step="documents" />
          <DocumentsStep bookingId={bookingId} form={form} state={latest} source={source} />
        </>
      ),
    },
    {
      id: 'checks',
      ...stepText('checks'),
      nextDisabled: blocking > 0,
      nextLabel: blocking === 0 && warnings > 0 ? t('checkin.wizard.checks.continueAnyway') : undefined,
      render: () => (
        <>
          <StepHelp step="checks" />
          <ChecksStep state={latest} />
        </>
      ),
    },
    {
      id: 'tax',
      ...stepText('tax'),
      render: ({ form }) => (
        <>
          <StepHelp step="tax" />
          <TaxStep bookingId={bookingId} form={form} state={latest} />
        </>
      ),
    },
    {
      id: 'send',
      ...stepText('send'),
      nextDisabled: blocking > 0,
      render: ({ form }) => (
        <>
          <StepHelp step="send" />
          <SendStep bookingId={bookingId} form={form} state={latest} />
        </>
      ),
    },
  ];

  const onFinish = async (values: CheckInWizardValues): Promise<CheckInConfirmation> => {
    // What the host typed and has not saved yet (a step reached from the list of steps, not with "Continue") is saved before it is confirmed:
    // the server confirms what it holds, and the summary the host read is the form.
    await saveGuests('documents', values);
    try {
      return await confirm.mutateAsync();
    } catch (error) {
      // 422 `checkin_not_ready`: the data changed under the host's hands. The checks show what is missing now.
      const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
      if (code === CHECKIN_NOT_READY_CODE) {
        void wizard.refetch();
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          next.set('step', 'checks');
          return next;
        });
      }
      throw error;
    }
  };

  return (
    <WizardShell<CheckInWizardValues, CheckInConfirmation>
      id={`checkin-${bookingId}`}
      steps={steps}
      defaultValues={initialValues}
      initialStepId={initialStepOf(state)}
      finishLabel={t('checkin.wizard.confirmAndSend')}
      finishFailedMessage={t('checkin.wizard.confirmFailed')}
      onFinish={onFinish}
      // The server is the draft: each step saves what it owns before moving on, and no personal data sit in the browser.
      draft={false}
      renderDone={({ result, values }) => {
        if (!result) return <Navigate to={{ search: '' }} replace />;
        const first = values.guests[0];
        const guestName = `${first?.firstName ?? ''} ${first?.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback');
        return <CheckInWizardDone bookingId={bookingId} guestName={guestName} result={result} />;
      }}
      aboveFooter={
        <>
          <ApplyFieldProblems problems={fieldProblems} />
          <SaveAndExit onSaveAndExit={saveAndExit} busy={exiting} problem={exitProblem} />
        </>
      }
      testIds={{
        root: 'checkin-wizard-form',
        back: 'checkin-wizard-back',
        next: 'checkin-wizard-next',
        finish: 'checkin-wizard-confirm',
        finishError: 'checkin-wizard-error',
      }}
    />
  );
}

/**
 * The host wizard "Guest check-in" of a booking (E03/F01/US04/T02, NF-40, NF-45, NF-46): guests, documents, checks, tax and send, on the
 * `WizardShell`, ending on "What happens now". The route is `/app/short-rent/bookings/:id/check-in`. The server is the draft: each step saves
 * what it owns before moving on and the browser keeps nothing. While the wizard is open the only ways out are "Save and exit" and the
 * no-show action; a stay for which no check-in is expected (a pending or cancelled booking, a no-show) says so and leads back.
 */
export function CheckInWizardPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const bookingId = id!;
  const stateQuery = useCheckInWizardState(bookingId);
  const state = stateQuery.data;

  if (stateQuery.isLoading) return <LoadingScreen message={t('checkin.wizard.loading')} />;

  // A failed first read stops the page; a failed read again of a state already on screen does not (the form would be lost).
  if (!state) {
    const notFound = getHttpStatus(stateQuery.error) === 404;
    return (
      <AppShell>
        <div className="mx-auto max-w-lg space-y-4 py-12 text-center" data-testid="checkin-wizard-load-error">
          <h2 className="text-xl font-semibold">{notFound ? t('checkin.wizard.notFound') : t('checkin.wizard.loadFailed')}</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {!notFound && (
              <Button type="button" variant="outline" onClick={() => void stateQuery.refetch()}>
                {t('checkin.wizard.retry')}
              </Button>
            )}
            <Button asChild>
              <Link to={BOOKINGS_PATH}>{t('checkin.wizard.toBookings')}</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const toBooking = (
    <Button variant="ghost" asChild>
      <Link to={stayPath(bookingId)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('checkin.wizard.toBooking')}
      </Link>
    </Button>
  );

  if (state.attendance === 'NoShow' || state.attendance === 'Inactive') {
    return (
      <AppShell>
        <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="checkin-wizard-page">
          <Breadcrumb />
          <PageHeader title={t('checkin.wizard.title')} />
          <Card data-testid="checkin-wizard-not-expected">
            <CardHeader>
              <CardTitle>{t(`checkin.wizard.notExpected.${state.attendance}.title`)}</CardTitle>
              <CardDescription>{t(`checkin.wizard.notExpected.${state.attendance}.text`)}</CardDescription>
            </CardHeader>
            <CardContent>{toBooking}</CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const dates = `${formatStayDate(state.booking.checkIn, i18n.language)} – ${formatStayDate(state.booking.checkOut, i18n.language)}`;

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="checkin-wizard-page">
        <Breadcrumb />
        <PageHeader
          title={t('checkin.wizard.title')}
          description={t('checkin.wizard.description', { property: state.booking.propertyName, dates })}
          action={state.capabilities.canMarkNoShow ? <NoShowAction bookingId={bookingId} /> : undefined}
        />
        <CheckInWizardForm key={bookingId} bookingId={bookingId} state={state} />
      </div>
    </AppShell>
  );
}
