import * as React from "react";
import { useSearchParams, type To } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldErrors,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { useWizardDraft } from "@/hooks/use-wizard-draft";
import { translateValidationMessage } from "@/i18n/validation-message";
import { getProblemMessage } from "@/lib/api-errors";
import { formatRomeDateTime } from "@/lib/stay-dates";
import type { WizardDraft } from "@/lib/wizard-draft";
import { cn } from "@/lib/utils";
import { WizardContext, type WizardContextValue } from "./wizard-context";

/** Name of the query parameter that carries the step: `?step=documents`, `?step=2` (the second step), `?step=fatto`. */
const STEP_PARAM = "step";
/** The value of `?step=` on the confirmation screen ("Cosa succede ora"). */
export const WIZARD_DONE_STEP = "fatto";

/** What the content of a step receives: the form of the whole wizard and where it stands. */
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
  /** Short name, in the list of steps. */
  label: string;
  /** What the step is about, as a heading. */
  title: string;
  /** One line that says what the step is for. */
  purpose?: string;
  /** A step the person may leave out: it gets "Skip". The step must accept being left empty. */
  optional?: boolean;
  /**
   * The rules of this step, as a Zod schema over the values of the wizard (a `z.object` with only the fields of the
   * step; the rest is ignored). The step does not advance while a rule fails. Messages are i18n keys, as in every form.
   */
  schema?: ZodType<unknown, FieldValues>;
  /** Label of the main button: say what it does ("Add the photos"). Default: "Continue: <next step>". */
  nextLabel?: string;
  /** Runs once the step is valid and before moving on (a save on the server). If it throws the wizard stays on the step. */
  beforeNext?: (values: TValues) => void | Promise<void>;
  /** The fields of the step. Do not render a `<form>` in here: the wizard already is one. Buttons must be `type="button"`. */
  render: (context: WizardStepContext<TValues>) => React.ReactNode;
}

/** `data-testid` of the parts of the wizard, for the pages whose tests already look for their own. */
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
  /** Name of the flow ("property-new"): the draft is kept under it. */
  id: string;
  steps: ReadonlyArray<WizardStep<TValues>>;
  /** What the answers are before the person types anything. A saved draft is laid over it. */
  defaultValues: DefaultValues<TValues>;
  /** The main button of the last step: it names what happens ("Create the property"), never "Send". */
  finishLabel: string;
  /** Does the work (the request that creates the thing). What it returns goes to `renderDone`. If it throws the wizard stays on the last step with the error. */
  onFinish: (values: TValues) => Promise<TResult> | TResult;
  /**
   * The confirmation screen, "What happens now" (`WizardDone`). Called when the work is done and also when `?step=fatto`
   * is opened again (a reload), with no `result`: it must make sense then too (link to the list, for example).
   */
  renderDone: (context: { result: TResult | undefined; values: TValues }) => React.ReactNode;
  /** Step to open when the address has no `?step` (the server remembers it, for example). Default: the first. */
  initialStepId?: string;
  /** Called when the person lands on another step (forward, back, from the address): save the progress. */
  onStepChange?: (change: { from: string; to: string; values: TValues }) => void;
  /**
   * The automatic draft. On by default. `exclude` lists the fields that are never saved because they are sensitive (fiscal
   * code, documents, IBAN, e-mail of third parties): `["fiscalCode", "guests.*.documentNumber"]`. `accept` can refuse a draft when
   * the flow opens (a draft older than what the server already knows). `false` turns it off.
   */
  draft?: false | { exclude?: readonly string[]; version?: number; accept?: (draft: WizardDraft) => boolean };
  /** "Cancel" on the first step: the draft is deleted and this runs (it takes the person out of the flow). */
  onExit?: () => void;
  /** What to say when `onFinish` fails and the error has no message of its own (the API's message is shown when it has one). */
  finishFailedMessage?: string;
  /** Something to show right above the buttons (a note about a failed save). */
  aboveFooter?: React.ReactNode;
  testIds?: Partial<WizardTestIds>;
  className?: string;
}

/** Index of the step an address points at: by name, or by number (1 is the first); -1 when it points at none. */
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

/** The messages of a form's errors, flat. Nested fields (`guests.0.name`) are walked; DOM references are skipped. */
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

// The buttons of a phone. They are the last child of the wizard (not of the form), so that they can stay in view for its
// whole length: a sticky box never leaves its container, and the form starts low on the screen. They stick right above the
// bottom bar and the home indicator of the phone, overlay only what scrolls beneath them, and the focus that goes to a field
// is scrolled in above them (`scroll-mb`). From `md` there is no bottom bar and they are the end of the form, as usual.
const FOOTER =
  "sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-10 -mx-4 border-t bg-background px-4 py-3 md:static md:z-auto md:mx-0 md:border-t-0 md:bg-transparent md:p-0";
// A name that does not fit goes to a second line instead of out of the screen (wide fonts, 360 px).
const BUTTON = "h-auto min-h-11 min-w-0 whitespace-normal py-2 text-center leading-tight";

/**
 * A guided flow: the steps (a compact bar on a phone), a title and a line of purpose for each, validation step by step,
 * an automatic draft, a summary and the final screen "What happens now". One focal point per step: the title, the fields
 * and one main button.
 *
 * It owns the form (react-hook-form), so the answers survive going back and forth, and the address (`?step=`), so the
 * browser's back button, a reload and a link to a step work. The address is not rewritten when the page opens.
 * Going forward needs the step to be valid (the focus goes to the first problem and it is announced); going back never
 * does; the last button checks all the steps and opens the first one that is not valid.
 *
 * Put it in a block that has a width of its own: `mx-auto w-full max-w-2xl`, and not `mx-auto max-w-2xl` alone. In a flex
 * column (the content of the shell is one) a centered block takes the width of its content, and the buttons, which reach the
 * edges of the screen on a phone, would stick out of it.
 *
 *     <WizardShell id="property-new" steps={steps} defaultValues={defaults} finishLabel={t("...")}
 *       onFinish={createProperty} renderDone={({ result }) => <WizardDone ... />} />
 */
export function WizardShell<TValues extends FieldValues, TResult = void>({
  id,
  steps,
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
  testIds,
  className,
}: WizardShellProps<TValues, TResult>) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = { ...DEFAULT_TEST_IDS, ...testIds };
  const titleId = React.useId();
  const formId = React.useId();

  // The draft: laid over the defaults when the wizard opens.
  const draftOn = draftOption !== false;
  const draft = useWizardDraft(id, {
    enabled: draftOn,
    exclude: draftOption ? draftOption.exclude : undefined,
    version: draftOption ? draftOption.version : undefined,
    accept: draftOption ? draftOption.accept : undefined,
  });
  const [initialValues] = React.useState(
    () => ({ ...defaultValues, ...(draft.restored?.values ?? {}) }) as DefaultValues<TValues>
  );

  // Where the wizard stands. The step the page opened on is remembered: "back" to an address without `?step` goes there.
  const [openingStepId] = React.useState(() => (steps.some((s) => s.id === initialStepId) ? initialStepId : steps[0]?.id));
  const stepParam = searchParams.get(STEP_PARAM);
  const isDone = stepParam === WIZARD_DONE_STEP;
  const fromAddress = resolveStepIndex(stepParam, steps);
  const stepIndex = fromAddress >= 0 ? fromAddress : Math.max(0, steps.findIndex((s) => s.id === openingStepId));
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const nextStep = isLast ? undefined : steps[stepIndex + 1];

  // The step where a "Continue" failed, and a counter that asks for the focus to go to the first problem.
  const [failedStepId, setFailedStepId] = React.useState<string | null>(null);
  const failedStepIdRef = React.useRef<string | null>(null);
  const [focusRequest, setFocusRequest] = React.useState(0);

  // The rules of the step on screen. The resolver always reads the latest step, so one form serves every step.
  const stepRef = React.useRef(step);
  const stepIdRef = React.useRef(step.id);
  React.useEffect(() => {
    stepRef.current = step;
    stepIdRef.current = step.id;
    failedStepIdRef.current = failedStepId;
  });
  const resolver = React.useCallback<Resolver<TValues>>(async (values, context, options) => {
    const schema = stepRef.current.schema;
    if (!schema) return { values, errors: {} };
    return (zodResolver(schema) as unknown as Resolver<TValues>)(values, context, options);
  }, []);
  const form = useForm<TValues>({ defaultValues: initialValues, resolver, mode: "onTouched", shouldUnregister: false });
  const problems = collectProblems(form.formState.errors);

  const [busy, setBusy] = React.useState(false);
  const [finishError, setFinishError] = React.useState<unknown>(null);
  const [result, setResult] = React.useState<{ value: TResult } | null>(null);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const handledFocusRequest = React.useRef(0);
  const revealProblemsOnArrival = React.useRef(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const summaryRef = React.useRef<HTMLDivElement>(null);
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

  // Every change of an answer is queued for the draft, with the step it was made on; and once a "Continue" has failed, the
  // field that changed is checked again, so its problem goes away as soon as the person fixes it (and not on the next blur).
  const saveDraft = draft.save;
  React.useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ values, name }) => {
        // `name` is the field that changed: the form opening, or a refresh of its state, is not something to keep.
        if (!name) return;
        if (draftOn) saveDraft({ step: stepIdRef.current, values: values as Record<string, unknown> });
        if (failedStepIdRef.current === stepIdRef.current) void form.trigger(name as Path<TValues>);
      },
    });
  }, [form, draftOn, saveDraft]);

  // Landing on another step: progress is told to the page and kept in the draft, the old problems go away and the
  // focus goes to the heading of the new step, which a screen reader reads. Not on the first render.
  const previousStepId = React.useRef(step.id);
  React.useEffect(() => {
    if (previousStepId.current === step.id) return;
    const from = previousStepId.current;
    previousStepId.current = step.id;
    if (isDone) return;
    const values = form.getValues();
    onStepChange?.({ from, to: step.id, values });
    saveDraft({ step: step.id, values: values as Record<string, unknown> });
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
  }, [step.id, isDone, form, onStepChange, saveDraft]);

  // After a failed "Continue", once the problems are on screen: the focus goes to the first field in error, or to the summary.
  React.useEffect(() => {
    if (focusRequest === 0 || handledFocusRequest.current === focusRequest || problems.length === 0) return;
    handledFocusRequest.current = focusRequest;
    const firstInvalid = panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (firstInvalid ?? summaryRef.current)?.focus();
  }, [focusRequest, problems.length]);

  // Once done, the wizard stays done: "back" from the confirmation does not reopen a form that would send the same thing twice.
  React.useEffect(() => {
    if (result && !isDone) goTo(WIZARD_DONE_STEP, true);
  }, [result, isDone, goTo]);

  const fail = () => {
    setFailedStepId(step.id);
    setFocusRequest((n) => n + 1);
  };

  const finish = async (values: TValues) => {
    // Every step has to hold: the first that does not is opened, with its problems.
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

  // The draft is ahead of the step the wizard opened on (and the address says nothing): offer to go on from there.
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

  const showSummary = failedStepId === step.id && problems.length > 0;
  const finishMessage = finishError ? (getProblemMessage(finishError, t) ?? finishFailedMessage ?? t("wizard.errors.finishFailed")) : null;

  return (
    <div data-testid={ids.root} data-step={step.id} className={cn("min-w-0 space-y-6", className)}>
      {showResume && draft.restored && (
        <Alert
          variant="info"
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

      <Stepper
        steps={steps.map(({ id: stepId, label }) => ({ id: stepId, label }))}
        current={stepIndex}
        onStepSelect={(index) => goTo(steps[index].id)}
      />

      <div className="min-w-0 space-y-1">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="break-words text-xl font-semibold tracking-tight outline-none">
          {step.title}
        </h2>
        {step.purpose && <p className="break-words text-sm text-muted-foreground">{step.purpose}</p>}
      </div>

      <FormProvider {...form}>
        <WizardContext.Provider value={context}>
          <form
            id={formId}
            noValidate
            aria-labelledby={titleId}
            className="min-w-0 space-y-6 max-md:[&_[aria-invalid=true]]:scroll-mb-40"
            onSubmit={(event) => {
              event.preventDefault();
              void advance();
            }}
          >
            {/* `key`: a new panel at each step. Without it React reuses the inputs of one step for the next one and the form
                library, which tells fields apart by their element, would not put the saved answers back when coming back. */}
            <div key={step.id} ref={panelRef} className="min-w-0 space-y-6">
              {step.render({ form, stepId: step.id, stepIndex, isLast, goTo })}
            </div>

            {/* A new element each time, so a second failed attempt is announced again. */}
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
              <Alert variant="danger" data-testid={ids.finishError}>
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
              <Button type="button" variant="ghost" data-testid={ids.skip} className={BUTTON} onClick={() => goTo(nextStep.id)}>
                {t("wizard.skip")}
              </Button>
            )}
            <Button
              type="submit"
              form={formId}
              loading={busy}
              data-testid={isLast ? ids.finish : ids.next}
              className={cn(BUTTON, "grow sm:grow-0")}
              iconRight={isLast ? <Check /> : <ArrowRight />}
            >
              {isLast ? finishLabel : (step.nextLabel ?? t("wizard.continueTo", { step: nextStep?.label }))}
            </Button>
          </div>
        </div>
        {draft.savedAt && (
          <p role="status" data-testid={ids.draftSaved} className="mt-2 text-xs text-muted-foreground md:text-right">
            {t("wizard.draft.savedAt", { time: savedTime(draft.savedAt) })}
          </p>
        )}
      </div>
    </div>
  );
}
