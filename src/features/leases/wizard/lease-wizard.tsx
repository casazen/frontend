import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FormProvider, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { leasesApi } from '@/api/leases.api';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { toastUndo } from '@/lib/toast-undo';
import { useForgetLeaseReads, useLeaseReview } from '@/queries/use-lease-draft';
import type { LandlordDefaults, LeaseDraft, LeaseDraftFlow, LeaseReading, LongRentRules } from '@/types';
import { DatesStep } from './dates-step';
import { ImportStep } from './import-step';
import { LeaseWizardFrame, WIZARD_BUTTON } from './lease-wizard-frame';
import { LeaseWizardStepper } from './lease-wizard-stepper';
import { MissingNote, type MissingItem } from './missing-note';
import { PartiesStep } from './parties-step';
import { PropertyStep } from './property-step';
import { ReadingArrivedNotice, ReadingBanner, ReadingProvider } from './reading-marks';
import { ReviewStep } from './review-step';
import { SigningStep } from './signing-step';
import { TermsStep } from './terms-step';
import { STEP_SCHEMAS } from './wizard-schemas';
import { stepWords } from './step-words';
import { useLeaseDraftSaver, type DraftSaveStatus, type SavedStep } from './use-lease-draft-saver';
import {
  REVIEW_STEP,
  SIGN_STEP,
  blockingNeeds,
  fieldIdOfNeed,
  flowStep,
  isBlankRow,
  isDataStep,
  leaseEditPath,
  markOf,
  reachedStep,
  registeredSteps,
  stepFromAddress,
  stepKey,
  stepOfField,
  toWizardValues,
  visibleSteps,
  type WizardValues,
} from './wizard-model';

const FORM_ID = 'lease-wizard-form';
const LEASES_PATH = '/app/long-rent/leases';

/** What a refused main button tells: the things in the way, each with the step where it is put right; `pressed` counts the refusals. */
interface Raised {
  step: number;
  items: MissingItem[];
  pressed: number;
}

function SaveIndicator({ status, savedAt, onRetry }: { status: DraftSaveStatus; savedAt: number | null; onRetry: () => void }) {
  const { t, i18n } = useTranslation();
  const time = savedAt ? formatRomeDateTime(new Date(savedAt).toISOString(), i18n.language, { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <p aria-live="polite" className="min-w-0 text-xs text-muted-foreground" data-testid="lease-save-status">
      {status === 'pending' || status === 'saving' ? t('leaseWizard.save.saving') : null}
      {status === 'saved' ? <span className="max-sm:sr-only">{t('leaseWizard.save.saved', { time })}</span> : null}
      {status === 'error' ? (
        <>
          <span className="text-[color:var(--color-danger-foreground,#b4232a)]">{t('leaseWizard.save.error')}</span>{' '}
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
            {t('leaseWizard.save.retry')}
          </button>
        </>
      ) : null}
    </p>
  );
}

interface LeaseWizardProps {
  draft: LeaseDraft;
  /** The landlord the server suggests, for a draft that has none yet. */
  defaults: LandlordDefaults | null;
  rules: LongRentRules;
  /** Reads the draft again: the person chose to see the version saved somewhere else. */
  onReload: () => void;
  /** The reading of the contract the person uploaded (NL-DOCS): which values it wrote, and the signed PDF the import can use. */
  reading?: LeaseReading | null;
}

/**
 * The wizard «Crea contratto» on a draft that exists on the server (LR-06a): the steps of the contract, the review, the saving.
 * The draft IS the contract: every change is saved as it is typed (`useLeaseDraftSaver`), the server says what each step still needs
 * (`flow`) and the steps show it; a draft opens on the first step that is not done, from any device. Nothing is kept in the browser.
 * «Avanti» goes on when the step has nothing left that was typed wrong or missing; an APE or the cadastral data of the property that
 * are missing only stop the review.
 */
export function LeaseWizard({ draft, defaults, rules, onReload, reading = null }: LeaseWizardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const imported = draft.origin === 'Imported';
  const sheetPath = `${LEASES_PATH}/${draft.id}`;

  const [initial] = useState(() => toWizardValues(draft.values, defaults));
  const [flow, setFlow] = useState(draft.flow);
  const flowRef = useRef(draft.flow);
  // The furthest step reached: ③ is not «Da completare» before it is opened, though the type chosen at the start is saved as a save of ③.
  const [maxStep, setMaxStep] = useState(() => reachedStep(draft));
  const [busy, setBusy] = useState(false);
  // The reading of the contract ended while this wizard was open (NL-DOCS-FU8): its values are on the server and not in the form. They are
  // not brought in under the person's hands (reading the draft again lost the last keystrokes, or gave a conflict of version): the person
  // is told, and shows them when they want. A wizard opened after the reading ended shows them from the start, as before.
  const [sawReading, setSawReading] = useState(false);
  if (reading?.state === 'Reading' && !sawReading) setSawReading(true);
  const arrived = sawReading && reading?.state === 'Done' && reading.fields.some((field) => field.state === 'Read');
  const [showing, setShowing] = useState(false);
  const [raised, setRaised] = useState<Raised | null>(null);
  const pressCount = useRef(0);
  const [focusRequest, setFocusRequest] = useState(0);
  const handledFocus = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const steps = visibleSteps(flow, registeredSteps(draft.origin));
  const current = stepFromAddress(searchParams.get('step'), flow, steps);
  const stepRef = useRef(current);
  useEffect(() => {
    stepRef.current = current;
  });

  // The rules of the step on screen: one form serves every step, so the answers survive going back and forth.
  const resolver = useCallback<Resolver<WizardValues>>(async (values, context, options) => {
    const step = stepRef.current;
    if (!isDataStep(step)) return { values, errors: {} };
    return (zodResolver(STEP_SCHEMAS[step]) as unknown as Resolver<WizardValues>)(values, context, options);
  }, []);
  const form = useForm<WizardValues>({ defaultValues: initial, resolver, mode: 'onTouched', shouldUnregister: false });
  const propertyId = useWatch({ control: form.control, name: 'propertyId' });
  const hasErrors = Object.keys(form.formState.errors).length > 0;

  const forgetReads = useForgetLeaseReads(draft.id);
  const getValues = useCallback(() => form.getValues(), [form]);
  const onSaved = useCallback(
    ({ step, saved, parties }: SavedStep) => {
      flowRef.current = saved.flow;
      setFlow(saved.flow);
      setMaxStep((value) => Math.max(value, step));
      // What was left when the main button was pressed may be done now: the line under the fields reads the flow again.
      setRaised(null);
      forgetReads();
      // The server gave an id to each entry it kept: it goes back with the next save, so the entry keeps its row.
      if (!parties) return;
      for (const list of ['landlords', 'tenants'] as const) {
        const ids = list === 'landlords' ? saved.landlordIds : saved.tenantIds;
        parties[list].forEach((key, position) => {
          const rows = form.getValues(list);
          const at = rows.findIndex((row) => row.key === key);
          if (at >= 0 && ids[position] && rows[at].serverId !== ids[position]) {
            form.setValue(`${list}.${at}.serverId`, ids[position], { shouldDirty: false });
          }
        });
      }
    },
    [form, forgetReads],
  );
  const saver = useLeaseDraftSaver({ leaseId: draft.id, version: draft.version, origin: draft.origin, getValues, onSaved });
  const { queue, flush, adopt, getVersion, stopOn } = saver;

  // Every change of a field is queued for its step.
  useEffect(() => {
    const subscription = form.watch((_values, info) => {
      const step = stepOfField(info.name);
      if (step !== null) queue(step);
    });
    return () => subscription.unsubscribe();
  }, [form, queue]);

  // The landlord the server suggests is on the screen from the start: it is saved when the step of the parties opens, so that what the
  // screen shows and what the server says is missing agree.
  const suggestedLandlord = useRef(draft.values.landlords.length === 0 && initial.landlords.some((row) => !isBlankRow(row)));
  useEffect(() => {
    if (current !== 2 || !suggestedLandlord.current) return;
    suggestedLandlord.current = false;
    queue(2);
  }, [current, queue]);

  // Landing on another step: the focus goes to its heading, which a screen reader reads.
  const previousStep = useRef(current);
  useEffect(() => {
    if (previousStep.current === current) return;
    previousStep.current = current;
    titleRef.current?.focus();
  }, [current]);

  // After a refused «Avanti», once the problems are on the screen: the focus goes to the first field in error.
  useEffect(() => {
    if (focusRequest === 0 || handledFocus.current === focusRequest || !hasErrors) return;
    handledFocus.current = focusRequest;
    panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest, hasErrors]);

  const review = useLeaseReview(draft.id, current === REVIEW_STEP);
  const reviewConfirmed = !!review.data?.reviewConfirmedAt;

  const stepHref = (step: number) => leaseEditPath(draft.id, step);
  const goTo = (step: number) => setSearchParams({ step: String(step) });
  const focusField = (id: string | null) => {
    if (id) document.getElementById(id)?.focus();
  };
  /** The main button was pressed with something left: the focus goes to the first thing, and the line under the fields says what it is. */
  const raise = (step: number, items: MissingItem[]) => {
    pressCount.current += 1;
    setRaised({ step, items, pressed: pressCount.current });
    const first = items[0];
    if (first && first.step === step) focusField(fieldIdOfNeed(first.need, form.getValues()));
  };

  const here = flowStep(flow, current);
  // What is left to do on this step. For a contract made in CasaZen the APE and the cadastral data of the property are part of it (they keep
  // the next step shut); for one already signed they are a notice and do not stop (`blockingNeeds`).
  const remaining = isDataStep(current) ? (imported ? blockingNeeds(here) : (here?.needs ?? [])) : [];
  // On the review what is left are the checks that block: each is put right at its own step.
  const blockingChecks: MissingItem[] =
    current === REVIEW_STEP
      ? (review.data?.checks ?? [])
          .filter((check) => check.severity === 'Block')
          .map((check) => ({ step: check.step, need: { code: check.code, params: check.params } }))
      : [];
  const nudge = raised && raised.step === current ? raised : null;
  const left: MissingItem[] = nudge ? nudge.items : [...remaining.map((need) => ({ step: current, need })), ...blockingChecks];
  const position = steps.indexOf(current);
  const previous = position > 0 ? steps[position - 1] : null;
  const next = position >= 0 && position < steps.length - 1 ? steps[position + 1] : null;
  const stopped = saver.status === 'conflict' || saver.status === 'gone';

  /** What the server answers to a change made outside the saving (the review, the download for the signature): the version and the flow. */
  const applyServerFlow = (version: number, nextFlow: LeaseDraftFlow) => {
    adopt(version);
    flowRef.current = nextFlow;
    setFlow(nextFlow);
    forgetReads();
  };

  /** The inverse of the confirmation, on the server: «Annulla» of the toast. The signature step (if the person is there) closes again. */
  const withdrawReview = async () => {
    const withdrawn = await leasesApi.withdrawReviewConfirmation(draft.id, getVersion());
    applyServerFlow(withdrawn.version, withdrawn.flow);
    void review.refetch();
    if (stepRef.current !== REVIEW_STEP) goTo(REVIEW_STEP);
  };

  const confirmReview = async () => {
    if (reviewConfirmed) {
      if (next !== null) goTo(next);
      return;
    }
    if (!(await flush())) return;
    try {
      const confirmation = await leasesApi.confirmReview(draft.id, getVersion());
      applyServerFlow(confirmation.version, confirmation.flow);
      await review.refetch();
      toastUndo(t('leaseWizard.review.confirmedToast'), { undo: withdrawReview });
      // «Conferma e vai alla firma» is one gesture: the confirmation can be taken back with the toast, which comes back to the review.
      if (next !== null) goTo(next);
    } catch (error) {
      if (!stopOn(error)) toast.error(getProblemMessage(error, t) ?? t('leaseWizard.review.confirmFailed'));
      void review.refetch();
    }
  };

  const advance = async () => {
    if (busy || stopped) return;
    setBusy(true);
    setRaised(null);
    try {
      if (current === REVIEW_STEP) {
        // Something blocks: the main button leads to the step where the first thing is put right, and the line under the checks says what.
        const firstBlock = reviewConfirmed ? undefined : blockingChecks[0];
        if (firstBlock) {
          goTo(firstBlock.step);
          return;
        }
        await confirmReview();
        return;
      }
      if (!(await form.trigger())) {
        setFocusRequest((value) => value + 1);
        return;
      }
      // Passing through a step saves it, even when nothing changed: the server counts the steps the person went through.
      if (isDataStep(current)) queue(current);
      if (!(await flush())) return;

      const blocking = blockingNeeds(flowStep(flowRef.current, current));
      if (blocking.length > 0) {
        raise(current, blocking.map((need) => ({ step: current, need })));
        return;
      }
      if (next === null) {
        navigate(sheetPath);
        return;
      }
      if (flowStep(flowRef.current, next)?.state === 'Locked') {
        // The next step opens when the ones before it are complete, the property's APE and cadastral data included.
        const items = flowRef.current.steps
          .filter((step) => isDataStep(step.step))
          .flatMap((step) => step.needs.map((need) => ({ step: step.step, need })));
        raise(current, items);
        return;
      }
      goTo(next);
    } finally {
      setBusy(false);
    }
  };

  /** «Salva e continua dopo»: what is typed is saved, the person leaves, and the contract waits among the drafts. */
  const saveAndLeave = async () => {
    if (!(await flush())) return;
    toast.success(t('leaseWizardGuide.later.saved'));
    navigate(LEASES_PATH);
  };

  /**
   * «Mostra i dati letti» (NL-DOCS-FU8): what is waiting to be saved goes first, on the version this draft has here, and only then is the
   * draft read again (the wizard starts from it, with the values read in their fields). A version the reading moved is the conflict
   * dialog's to settle, which also reads the draft again: nothing is replaced behind the person's back.
   */
  const showReading = async () => {
    setShowing(true);
    try {
      if (await flush()) onReload();
    } finally {
      setShowing(false);
    }
  };

  // The main button says what it does, with the verb of the step it leads to: «Salva e vai alle parti».
  const nextLabel =
    current === REVIEW_STEP && !reviewConfirmed
      ? t('leaseWizardGuide.next.confirm')
      : next === null
        ? t('leaseWizard.finish')
        : t(`leaseWizardGuide.next.to.${stepKey(next, draft.origin)}`);
  // It stays pressable while something is left (it leads to the first thing); only a review that is not there yet cannot be confirmed.
  const reviewBlocked = current === REVIEW_STEP && (review.isLoading || review.isError) && !reviewConfirmed;

  const entries = steps.map((step) => ({
    step,
    label: t(`leaseWizard.steps.${stepKey(step, draft.origin)}.label`),
    mark: markOf(flowStep(flow, step), step === current, step <= Math.max(maxStep, current)),
    to: stepHref(step),
  }));

  // The signed contract the person gave to be read is the one the import takes: it is not asked for again.
  const contractDocument = reading?.documents.find((document) => document.id === reading.contractDocumentId);
  const uploadedContract = contractDocument ? { id: contractDocument.id, name: contractDocument.fileName } : null;

  let body: ReactNode;
  if (current === 1) {
    body = (
      <PropertyStep
        value={propertyId}
        onChange={(id) => form.setValue('propertyId', id, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
        error={form.formState.errors.propertyId?.message}
        needs={flowStep(flow, 1)?.needs}
        imported={imported}
      />
    );
  } else if (current === 2) {
    body = <PartiesStep />;
  } else if (current === 3) {
    body = <TermsStep rules={rules} origin={draft.origin} />;
  } else if (current === 4) {
    body = <DatesStep rules={rules} origin={draft.origin} />;
  } else if (current === SIGN_STEP) {
    body =
      draft.origin === 'Imported' ? (
        <ImportStep
          leaseId={draft.id}
          contractType={form.getValues('contractType')}
          flush={flush}
          uploaded={uploadedContract}
          stipulaRead={reading?.stipulaDate ?? null}
        />
      ) : (
        <SigningStep leaseId={draft.id} flow={flow} getVersion={getVersion} onServerFlow={applyServerFlow} stopOn={stopOn} flush={flush} />
      );
  } else {
    body = <ReviewStep review={review} hrefOfStep={stepHref} values={form.getValues()} rules={rules} />;
  }

  const words = stepWords(t, i18n, current, draft.origin);

  const footer = (
    <>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {isDataStep(current) || (current === REVIEW_STEP && left.length > 0) ? (
          <MissingNote
            className="min-w-0 sm:flex-1"
            items={left}
            current={current}
            pressed={nudge?.pressed ?? 0}
            hrefOfStep={stepHref}
            onGo={(need) => focusField(fieldIdOfNeed(need, form.getValues()))}
          />
        ) : null}
        <SaveIndicator status={saver.status} savedAt={saver.savedAt} onRetry={() => void flush()} />
      </div>

      {/* The main button is the one strong thing; on a phone it is on top and the two quiet ones under it. */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          {previous !== null ? (
            <Button type="button" variant="ghost" className={`${WIZARD_BUTTON} max-sm:min-w-11`} onClick={() => goTo(previous)} data-testid="lease-wizard-back">
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
              <span className="max-sm:sr-only">{t('leaseWizard.back')}</span>
            </Button>
          ) : null}
          {current !== SIGN_STEP ? (
            <Button
              type="button"
              variant="ghost"
              className={`${WIZARD_BUTTON} max-sm:flex-1`}
              onClick={() => void saveAndLeave()}
              disabled={stopped}
              data-testid="lease-wizard-save"
            >
              {t('leaseWizardGuide.later.action')}
            </Button>
          ) : null}
        </div>
        {current !== SIGN_STEP ? (
          <Button
            type="submit"
            form={FORM_ID}
            loading={busy}
            disabled={stopped || reviewBlocked}
            iconRight={next === null ? <Check /> : <ArrowRight />}
            className={`${WIZARD_BUTTON} w-full sm:ml-auto sm:w-auto`}
            data-testid="lease-wizard-next"
          >
            {nextLabel}
          </Button>
        ) : null}
      </div>
    </>
  );

  return (
    // The marks wait for the values: until the person asks for them, nothing in the fields says «letto dal contratto».
    <ReadingProvider reading={arrived ? null : reading} flow={flow} leaseId={draft.id}>
      <ReadingBanner reading={reading ?? undefined} flow={flow} held={arrived} />
      {arrived ? <ReadingArrivedNotice onShow={() => void showReading()} busy={showing} /> : null}
      <LeaseWizardFrame
        stepper={<LeaseWizardStepper entries={entries} current={current} />}
        position={{ current: position + 1, total: steps.length }}
        title={words.title}
        summary={words.summary}
        inHand={words.inHand}
        titleRef={titleRef}
        footer={footer}
      >
        {saver.status === 'gone' ? (
          <Alert variant="danger" data-testid="lease-wizard-gone">
            {t('leaseWizard.gone')}{' '}
            <Link to={sheetPath} className="font-semibold underline underline-offset-2">
              {t('leaseWizard.goToLease')}
            </Link>
          </Alert>
        ) : null}
        {current === SIGN_STEP ? (
          // No form around the signature step: it has no answers to save, and its windows would otherwise sit inside a form for React.
          <div key={current} ref={panelRef} className="min-w-0 space-y-6">
            {body}
          </div>
        ) : (
          <FormProvider {...form}>
            <form
              id={FORM_ID}
              noValidate
              aria-label={words.title}
              onSubmit={(event) => {
                event.preventDefault();
                void advance();
              }}
            >
              <div key={current} ref={panelRef} className="min-w-0 space-y-6">
                {body}
              </div>
            </form>
          </FormProvider>
        )}
      </LeaseWizardFrame>

      {/* Outside the form: a dialog sits inside it for React, and its buttons would send it. Closing it is reading the draft again. */}
      <Dialog open={saver.status === 'conflict'} onOpenChange={(open) => !open && onReload()}>
        <DialogContent onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{arrived ? t('leaseRound.reading.conflict') : t('leaseWizard.conflict.title')}</DialogTitle>
            <DialogDescription>{t('leaseWizard.conflict.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={onReload} data-testid="lease-conflict-reload">
              {t('leaseWizard.conflict.reload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReadingProvider>
  );
}
