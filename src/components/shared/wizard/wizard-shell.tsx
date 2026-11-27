import * as React from "react";
import { useSearchParams, type To } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  FormProvider,
  useForm,
  useWatch,
  type DefaultValues,
  type FieldErrors,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Stepper } from "@/components/ui/stepper";
import { SaveIndicator } from "@/components/shared/save-indicator";
import { WizardConflictDialog } from "@/components/shared/wizard-conflict-dialog";
import { FROM_WIDE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useWizardDraft, type UseWizardDraft, type WizardDraftServer } from "@/hooks/use-wizard-draft";
import { translateValidationMessage } from "@/i18n/validation-message";
import { getProblemMessage } from "@/lib/api-errors";
import { formatRomeDateTime } from "@/lib/stay-dates";
import { useAppShell } from "@/components/layout/app-shell-context";
import { useUiStore } from "@/store/ui-store";
import { useWizardOpenFlag } from "@/store/use-wizard-open-flag";
import type { WizardDraft } from "@/lib/wizard-draft";
import { cn } from "@/lib/utils";
import { WizardContext, type WizardContextValue } from "./wizard-context";

const STEP_PARAM = "step";
export const WIZARD_DONE_STEP = "fatto";

export interface WizardStepContext<TValues extends FieldValues> {
  form: UseFormReturn<TValues>;
  stepId: string;
  stepIndex: number;
  isLast: boolean;
  goTo: (stepId: string) => void;
}

export interface WizardStep<TValues extends FieldValues> {
  /** Stable name of the step: it is what `?step=` carries, so it can be linked to (`?step=cin`). */
  id: string;
  label: string;
  title: string;
  purpose?: string;
  optional?: boolean;
  schema?: ZodType<unknown, FieldValues>;
  nextLabel?: string;
  beforeNext?: (values: TValues) => void | Promise<void>;
  nextDisabled?: boolean;
  render: (context: WizardStepContext<TValues>) => React.ReactNode;
}

export interface WizardTestIds {
  root: string;
  back: string;
  next: string;
  skip: string;
  finish: string;
  exit: string;
  finishError: string;
  errorSummary: string;
  draftBanner: string;
  draftResume: string;
  draftRestart: string;
  draftSaved: string;
}

const DEFAULT_TEST_IDS: WizardTestIds = {
  root: "wizard-shell",
  back: "wizard-back",
  next: "wizard-next",
  skip: "wizard-skip",
  finish: "wizard-finish",
  exit: "wizard-exit",
  finishError: "wizard-finish-error",
  errorSummary: "wizard-error-summary",
  draftBanner: "wizard-draft-banner",
  draftResume: "wizard-draft-resume",
  draftRestart: "wizard-draft-restart",
  draftSaved: "wizard-draft-saved",
};

export interface WizardShellProps<TValues extends FieldValues, TResult = void> {
  id: string;
  steps: ReadonlyArray<WizardStep<TValues>>;
  stepsFor?: (values: TValues) => ReadonlyArray<WizardStep<TValues>>;
  defaultValues: DefaultValues<TValues>;
  finishLabel: string;
  onFinish: (values: TValues) => Promise<TResult> | TResult;
  renderDone: (context: { result: TResult | undefined; values: TValues }) => React.ReactNode;
  initialStepId?: string;
  onStepChange?: (change: { from: string; to: string; values: TValues }) => void;
  /**
   * The automatic draft. On by default. `exclude` lists the fields that are never saved because they are sensitive (fiscal
   * code, documents, IBAN, e-mail of third parties): `["fiscalCode", "guests.*.documentNumber"]`. `accept` can refuse a draft when
   * the flow opens (a draft older than what the server already knows). `server` also keeps the draft on the server, to resume it on
   * another device (ADR-024): the wizard shows a spinner until the draft of the server is read, shows where the saving stands
   * (`SaveIndicator`) in place of the «Draft saved at» line, and asks which version to keep when two devices saved the same
   * draft (`WizardConflictDialog`). `false` turns it off.
   */
  draft?: false | { exclude?: readonly string[]; version?: number; accept?: (draft: WizardDraft) => boolean; server?: WizardDraftServer };
  onExit?: () => void;
  finishFailedMessage?: string;
  aboveFooter?: React.ReactNode;
  /**
   * Something to show under the bar of the buttons, in the form's reach (`useFormContext`, `useOptionalWizard`) but outside the form: the way out of a flow ("Save and
   * exit"). It follows the bar and is never put between the message of a refused finish and the bar: on a phone the page scrolls that message in, the toast comes up
   * over the room of the bar, and whatever sits between the two would push the buttons down into the toast; what follows the bar also keeps the bar clear of the
   * toast when the page is at its end.
   */
  belowFooter?: React.ReactNode;
  /**
   * The way between the steps is shut for now, because a request that must not meet the save of a change of step is on its way (the flow is leaving): "Back",
   * "Skip" and the steps of the list take no press. The main button has `nextDisabled` for the same. Default: open.
   */
  navigationDisabled?: boolean;
  testIds?: Partial<WizardTestIds>;
  className?: string;
}

function resolveStepIndex(param: string | null, steps: ReadonlyArray<{ id: string }>): number {
  if (!param) return -1;
  const byId = steps.findIndex((step) => step.id === param);
  if (byId >= 0) return byId;
  if (/^\d{1,3}$/.test(param)) {
    const number = Number(param);
    if (number >= 1 && number <= steps.length) return number - 1;
  }
  return -1;
}

interface FieldProblem {
  path: string;
  message: string;
}

function collectProblems(errors: FieldErrors, prefix = ""): FieldProblem[] {
  const found: FieldProblem[] = [];
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const entry = value as { message?: unknown } & Record<string, unknown>;
    if (typeof entry.message === "string" && entry.message) found.push({ path, message: entry.message });
    const children = Object.fromEntries(
      Object.entries(entry).filter(([childKey]) => !["ref", "type", "message", "types", "root"].includes(childKey))
    );
    found.push(...collectProblems(children as FieldErrors, path));
  }
  return found;
}

const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

// The buttons of a phone. They are a child of the column of the step, which on a phone holds the whole wizard (not of the form),
// so that they can stay in view for its whole length: a sticky box never leaves its container, and the form starts low on the
// screen. They stick right above the bottom bar and the home indicator of the phone, overlay only what scrolls beneath them,
// and the focus that goes to a field is scrolled in above them (`scroll-mb`). From `md` there is no bottom bar and they are the
// end of the form, as usual.
const FOOTER =
  "sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-10 border-t bg-card px-3 py-3 md:static md:z-auto sm:px-6";
// A name that does not fit goes to a second line instead of out of the screen (wide fonts, 360 px).
const BUTTON = "rounded-full h-auto min-h-11 min-w-0 whitespace-normal py-2 text-center leading-tight";
const WIDE_COLUMNS = "grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-5";
const STEPS_COLUMN =
  "sticky top-[calc(var(--header-height)+1.5rem)] max-h-[calc(100dvh-var(--header-height)-3rem)] min-w-0 overflow-y-auto rounded-2xl border bg-card p-5 shadow-sm";

/**
 * A guided flow: the steps (a compact bar on a phone, a column beside the step from `2xl`), a title and a line of purpose for
 * each, validation step by step, an automatic draft, a summary and the final screen "What happens now". One focal point per
 * step: the title, the fields and one main button.
 *
 * It owns the form (react-hook-form), so the answers survive going back and forth, and the address (`?step=`), so the
 * browser's back button, a reload and a link to a step work. The address is not rewritten when the page opens.
 * Going forward needs the step to be valid (the focus goes to the first problem and it is announced); going back never
 * does; the last button checks all the steps and opens the first one that is not valid.
 *
 * Put it in a block that has a width of its own: `FOCUS_COLUMN` (`@/components/layout/page-columns`: `w-full`, as wide as the page,
 * from the left edge of the title above it), and not `mx-auto max-w-2xl` alone. In a flex column (the content of the shell is one)
 * a centered block takes the width of its content, and the buttons, which reach the edges of the screen on a phone, would stick
 * out of it. On a wide screen (`2xl`) the steps leave the bar above the title for a column of their own beside the step
 * (`Stepper orientation="vertical"`), so that the fields do not run across the whole screen. Under `2xl` nothing changes but
 * the width: the step is as wide as the page, with the bar of the steps above its title.
 *
 *     <WizardShell id="property-new" steps={steps} defaultValues={defaults} finishLabel={t("...")}
 *       onFinish={createProperty} renderDone={({ result }) => <WizardDone ... />} />
 */
export function WizardShell<TValues extends FieldValues, TResult = void>(props: WizardShellProps<TValues, TResult>) {
  const { id, draft: draftOption, testIds, className } = props;
  const draft = useWizardDraft(id, {
    enabled: draftOption !== false,
    exclude: draftOption ? draftOption.exclude : undefined,
    version: draftOption ? draftOption.version : undefined,
    accept: draftOption ? draftOption.accept : undefined,
    server: draftOption ? draftOption.server : undefined,
  });

  if (!draft.ready) {
    return (
      <div data-testid={testIds?.root ?? DEFAULT_TEST_IDS.root} aria-busy="true" className={cn("flex min-w-0 justify-center py-12", className)}>
        <Spinner size="lg" />
      </div>
    );
  }
  return <WizardShellBody {...props} draftState={draft} />;
}

function WizardShellBody<TValues extends FieldValues, TResult = void>({
  steps: stepsOfFlow,
  stepsFor,
  defaultValues,
  finishLabel,
  onFinish,
  renderDone,
  initialStepId,
  onStepChange,
  draft: draftOption,
  onExit,
  finishFailedMessage,
  aboveFooter,
  belowFooter,
  navigationDisabled,
  testIds,
  className,
  draftState: draft,
}: WizardShellProps<TValues, TResult> & { draftState: UseWizardDraft }) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = { ...DEFAULT_TEST_IDS, ...testIds };
  const titleId = React.useId();
  const formId = React.useId();

  const draftOn = draftOption !== false;
  const serverOn = draftOption ? Boolean(draftOption.server) : false;
  const [initialValues] = React.useState(
    () => ({ ...defaultValues, ...(draft.restored?.values ?? {}) }) as DefaultValues<TValues>
  );

  const stepRef = React.useRef<WizardStep<TValues> | null>(null);
  const stepIdRef = React.useRef("");
  const resolver = React.useCallback<Resolver<TValues>>(async (values, context, options) => {
    const schema = stepRef.current?.schema;
    if (!schema) return { values, errors: {} };
    return (zodResolver(schema) as unknown as Resolver<TValues>)(values, context, options);
  }, []);
  const form = useForm<TValues>({ defaultValues: initialValues, resolver, mode: "onTouched", shouldUnregister: false });
  const problems = collectProblems(form.formState.errors);
  const values = useWatch({ control: form.control, compute: (answers) => answers });
  const steps = React.useMemo(() => (stepsFor ? stepsFor(values as TValues) : stepsOfFlow), [stepsFor, stepsOfFlow, values]);

  const [openingStepId] = React.useState(() => (steps.some((s) => s.id === initialStepId) ? initialStepId : steps[0]?.id));
  const stepParam = searchParams.get(STEP_PARAM);
  const isDone = stepParam === WIZARD_DONE_STEP;
  const fromAddress = resolveStepIndex(stepParam, steps);
  const stepIndex = fromAddress >= 0 ? fromAddress : Math.max(0, steps.findIndex((s) => s.id === openingStepId));
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const nextStep = isLast ? undefined : steps[stepIndex + 1];

  const [failedStepId, setFailedStepId] = React.useState<string | null>(null);
  const [focusRequest, setFocusRequest] = React.useState(0);

  React.useEffect(() => {
    stepRef.current = step;
    stepIdRef.current = step.id;
  });

  React.useEffect(() => {
    if (failedStepId === step.id) void form.trigger();
  }, [values, failedStepId, step.id, form]);

  const [busy, setBusy] = React.useState(false);
  const [finishError, setFinishError] = React.useState<unknown>(null);
  const [result, setResult] = React.useState<{ value: TResult } | null>(null);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const handledFocusRequest = React.useRef(0);
  const revealProblemsOnArrival = React.useRef(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const finishErrorRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  const goTo = React.useCallback(
    (stepId: string, replace = false) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(STEP_PARAM, stepId);
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );
  const hrefFor = React.useCallback(
    (stepId: string): To => {
      const next = new URLSearchParams(searchParams);
      next.set(STEP_PARAM, stepId);
      return { search: `?${next.toString()}` };
    },
    [searchParams]
  );

  const setMobilePrimaryVisible = useUiStore((state) => state.setMobilePrimaryVisible);
  React.useEffect(() => {
    if (isDone) return undefined;
    setMobilePrimaryVisible(true);
    return () => setMobilePrimaryVisible(false);
  }, [isDone, setMobilePrimaryVisible]);

  useWizardOpenFlag();

  const viewKey = useAppShell()?.viewKey;
  const focusForms = useUiStore(state => Boolean(viewKey && state.workspaceViews[viewKey]?.focusForms));
  const wideScreen = useMediaQuery(FROM_WIDE_QUERY);
  const wide = wideScreen && !focusForms;

  const saveDraft = draft.save;
  React.useEffect(() => {
    const { unsubscribe } = form.watch((values, info) => {
      if (!info.name) return;
      if (draftOn) saveDraft({ step: stepIdRef.current, values: values as Record<string, unknown> });
    });
    return unsubscribe;
  }, [form, draftOn, saveDraft]);

  const flushDraft = draft.flush;
  const previousStepId = React.useRef(step.id);
  React.useEffect(() => {
    if (previousStepId.current === step.id) return;
    const from = previousStepId.current;
    previousStepId.current = step.id;
    if (isDone) return;
    const values = form.getValues();
    onStepChange?.({ from, to: step.id, values });
    saveDraft({ step: step.id, values: values as Record<string, unknown> });
    if (serverOn) flushDraft();
    form.clearErrors();
    titleRef.current?.focus();
    if (revealProblemsOnArrival.current) {
      revealProblemsOnArrival.current = false;
      void form.trigger().then((valid) => {
        if (!valid) {
          setFailedStepId(step.id);
          setFocusRequest((n) => n + 1);
        }
      });
    }
  }, [step.id, isDone, form, onStepChange, saveDraft, serverOn, flushDraft]);

  React.useEffect(() => {
    if (focusRequest === 0 || handledFocusRequest.current === focusRequest || problems.length === 0) return;
    handledFocusRequest.current = focusRequest;
    const firstInvalid = panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (firstInvalid ?? summaryRef.current)?.focus();
  }, [focusRequest, problems.length]);

  React.useEffect(() => {
    if (finishError) finishErrorRef.current?.focus();
  }, [finishError]);

  React.useEffect(() => {
    if (result && !isDone) goTo(WIZARD_DONE_STEP, true);
  }, [result, isDone, goTo]);

  const fail = () => {
    setFailedStepId(step.id);
    setFocusRequest((n) => n + 1);
  };

  const finish = async (values: TValues) => {
    for (const other of steps) {
      if (other.id === step.id || !other.schema) continue;
      if (!other.schema.safeParse(values).success) {
        revealProblemsOnArrival.current = true;
        goTo(other.id);
        return;
      }
    }
    const value = await onFinish(values);
    draft.clear();
    setResult({ value });
  };

  const advance = async () => {
    if (busy) return;
    setBusy(true);
    setFinishError(null);
    try {
      if (!(await form.trigger())) {
        fail();
        return;
      }
      const values = form.getValues();
      await step.beforeNext?.(values);
      if (isLast) await finish(values);
      else if (nextStep) goTo(nextStep.id);
    } catch (error) {
      setFinishError(error);
    } finally {
      setBusy(false);
    }
  };

  const savedTime = (instant: number) => formatRomeDateTime(new Date(instant).toISOString(), i18n.language, TIME_ONLY);

  const context = React.useMemo<WizardContextValue>(
    () => ({
      stepId: step.id,
      stepIndex,
      steps: steps.map(({ id: stepId, label }) => ({ id: stepId, label })),
      hrefFor,
      goTo,
    }),
    [step.id, stepIndex, steps, hrefFor, goTo]
  );

  if (isDone) {
    return (
      <div data-testid={ids.root} data-step={WIZARD_DONE_STEP} className={cn("min-w-0", className)}>
        {renderDone({ result: result?.value, values: form.getValues() })}
      </div>
    );
  }

  const restoredStepIndex = draft.restored ? steps.findIndex((s) => s.id === draft.restored?.step) : -1;
  const showResume = Boolean(draft.restored) && !bannerDismissed && stepParam === null && restoredStepIndex > stepIndex;

  const restart = () => {
    draft.clear();
    form.reset(defaultValues);
    setBannerDismissed(true);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(STEP_PARAM);
        return next;
      },
      { replace: true }
    );
  };

  const takeTheirs = () => {
    const theirs = draft.takeTheirs();
    if (!theirs) return;
    form.reset({ ...defaultValues, ...theirs.values } as DefaultValues<TValues>);
    if (steps.some((s) => s.id === theirs.step)) goTo(theirs.step);
  };

  const showSummary = failedStepId === step.id && problems.length > 0;
  const finishMessage = finishError ? (getProblemMessage(finishError, t) ?? finishFailedMessage ?? t("wizard.errors.finishFailed")) : null;
  const stepperSteps = steps.map(({ id: stepId, label }) => ({ id: stepId, label }));
  const selectStep = navigationDisabled ? undefined : (index: number) => goTo(steps[index].id);

  return (
    <div data-testid={ids.root} data-step={step.id} className={cn("min-w-0", wide && WIDE_COLUMNS, className)}>
      <div className="min-w-0 rounded-2xl border bg-card text-card-foreground shadow-sm">
        {showResume && draft.restored && (
          <Alert
            variant="info"
            className="m-3 sm:m-5"
            data-testid={ids.draftBanner}
            title={t("wizard.draft.resumeTitle", { time: savedTime(draft.restored.savedAt) })}
            action={
              <>
                <Button
                  type="button"
                  size="sm"
                  data-testid={ids.draftResume}
                  onClick={() => {
                    setBannerDismissed(true);
                    goTo(steps[restoredStepIndex].id);
                  }}
                >
                  {t("wizard.draft.resume", { number: restoredStepIndex + 1 })}
                </Button>
                <Button type="button" size="sm" variant="ghost" data-testid={ids.draftRestart} onClick={restart}>
                  {t("wizard.draft.restart")}
                </Button>
              </>
            }
          >
            {t("wizard.draft.resumeText", {
              current: restoredStepIndex + 1,
              total: steps.length,
              step: steps[restoredStepIndex].label,
            })}
          </Alert>
        )}

        {focusForms ? (
          <details key={step.id} className="rounded-t-2xl border-b px-4 py-2">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-medium focus-visible:outline-ring">
              {t("ui.stepper.stepOf", { current: stepIndex + 1, total: steps.length })}
            </summary>
            <Stepper orientation="vertical" steps={stepperSteps} current={stepIndex} onStepSelect={selectStep} />
          </details>
        ) : wide ? null : <Stepper className="rounded-t-2xl border-b bg-muted/45 px-3 py-3 sm:px-6 sm:py-4" steps={stepperSteps} current={stepIndex} onStepSelect={selectStep} />}

        <div className="min-w-0 space-y-2 px-3 pb-5 pt-6 sm:px-6 sm:pt-8">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="break-words text-2xl font-semibold leading-tight tracking-tight outline-none sm:text-3xl">
            {step.title}
          </h2>
          {step.purpose && <p className="max-w-prose break-words text-base leading-relaxed text-muted-foreground">{step.purpose}</p>}
        </div>

        <FormProvider {...form}>
          <WizardContext.Provider value={context}>
            <form
              id={formId}
              noValidate
              aria-labelledby={titleId}
              className="mx-3 min-w-0 space-y-6 pb-6 sm:mx-6 max-md:[&_[aria-invalid=true]]:scroll-mb-40"
              onBlur={serverOn ? draft.onBlur : undefined}
              onSubmit={(event) => {
                event.preventDefault();
                void advance();
              }}
            >
              <div key={step.id} ref={panelRef} className="cz-enter min-w-0 space-y-6">
                {step.render({ form, stepId: step.id, stepIndex, isLast, goTo })}
              </div>

              <p key={focusRequest} role="status" className="sr-only">
                {showSummary ? t("wizard.errors.summary", { count: problems.length }) : null}
              </p>
              {showSummary && (
                <Alert
                  ref={summaryRef}
                  variant="danger"
                  role="group"
                  tabIndex={-1}
                  aria-label={t("wizard.errors.summary", { count: problems.length })}
                  data-testid={ids.errorSummary}
                  title={t("wizard.errors.summary", { count: problems.length })}
                  className="outline-none max-md:scroll-mb-40"
                >
                  <ul className="list-disc space-y-0.5 pl-5">
                    {problems.map((problem) => (
                      <li key={problem.path}>{translateValidationMessage(problem.message, t, i18n)}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {finishMessage && (
                <Alert ref={finishErrorRef} variant="danger" tabIndex={-1} data-testid={ids.finishError} className="outline-none max-md:scroll-mb-40">
                  {finishMessage}
                </Alert>
              )}
              {aboveFooter}
            </form>
          </WizardContext.Provider>
        </FormProvider>

        <div className={FOOTER}>
          <div className="flex flex-wrap items-center gap-2">
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                data-testid={ids.back}
                className={BUTTON}
                disabled={navigationDisabled}
                onClick={() => goTo(steps[stepIndex - 1].id)}
              >
                <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
                {t("wizard.back")}
              </Button>
            ) : onExit ? (
              <Button
                type="button"
                variant="ghost"
                data-testid={ids.exit}
                className={BUTTON}
                onClick={() => {
                  draft.clear();
                  onExit();
                }}
              >
                {t("wizard.cancel")}
              </Button>
            ) : null}
            <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              {step.optional && nextStep && (
                <Button type="button" variant="ghost" data-testid={ids.skip} className={BUTTON} disabled={navigationDisabled} onClick={() => goTo(nextStep.id)}>
                  {t("wizard.skip")}
                </Button>
              )}
              <Button
                type="submit"
                form={formId}
                loading={busy}
                disabled={step.nextDisabled}
                data-testid={isLast ? ids.finish : ids.next}
                className={cn(BUTTON, "grow px-5 sm:grow-0")}
                iconRight={isLast ? <Check /> : <ArrowRight />}
              >
                {isLast ? finishLabel : (step.nextLabel ?? t("wizard.continueTo", { step: nextStep?.label }))}
              </Button>
            </div>
          </div>
          {serverOn ? (
            <SaveIndicator
              status={draft.status}
              savedAt={draft.serverSavedAt}
              onRetry={draft.retry}
              data-testid={ids.draftSaved}
              className="mt-2 md:text-right"
            />
          ) : (
            draft.savedAt && (
              <p role="status" data-testid={ids.draftSaved} className="mt-2 text-xs text-muted-foreground md:text-right">
                {t("wizard.draft.savedAt", { time: savedTime(draft.savedAt) })}
              </p>
            )
          )}
        </div>

        {belowFooter ? (
          <FormProvider {...form}>
            <WizardContext.Provider value={context}><div className="px-3 pb-4 sm:px-6">{belowFooter}</div></WizardContext.Provider>
          </FormProvider>
        ) : null}
      </div>

      {wide ? (
        <div className={STEPS_COLUMN}>
          <Stepper orientation="vertical" steps={stepperSteps} current={stepIndex} onStepSelect={selectStep} />
        </div>
      ) : null}

      {draft.conflict ? (
        <WizardConflictDialog
          open
          serverDraft={draft.conflict.serverDraft}
          serverVersion={draft.conflict.serverVersion}
          onKeepMine={draft.keepMine}
          onTakeTheirs={takeTheirs}
        />
      ) : null}
    </div>
  );
}
