import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface StepperStep {
  id: string;
  /** Name of the step, already translated. */
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index (from 0) of the step the person is on. The steps before it are done, the ones after it are still to do. */
  current: number;
  /**
   * Called with the index of a done step the person picks. Only done steps can be picked (the ones ahead may depend on
   * answers not given yet); without this function no step is a button.
   */
  onStepSelect?: (index: number) => void;
  /** Name of the list for assistive technology. The default is "Steps". */
  label?: string;
  /**
   * `horizontal` (the default): on a phone one line ("Step 2 of 6", the name of the step and a bar), from `md` up every step side by
   * side. `vertical`: "Step 2 of 6" and the steps one under the other at every width, for a narrow column beside the content (the
   * steps of a wizard on a wide screen). The states, the names and the steps that are buttons are the same in both.
   */
  orientation?: "horizontal" | "vertical";
  className?: string;
}

type StepState = "done" | "current" | "todo";

const BAR: Record<StepState, string> = {
  done: "bg-primary",
  current: "bg-[linear-gradient(90deg,var(--color-primary)_50%,var(--color-muted)_50%)]",
  todo: "bg-muted",
};

const NUMBER: Record<StepState, string> = {
  done: "bg-primary text-primary-foreground",
  current: "bg-background text-primary ring-2 ring-primary",
  todo: "bg-background text-muted-foreground ring-1 ring-inset ring-border",
};

const LABEL: Record<StepState, string> = {
  done: "text-muted-foreground",
  current: "text-foreground",
  todo: "text-muted-foreground",
};

const ITEM = "flex min-w-0 flex-1 flex-col gap-2 text-left";
/** A step of the vertical list: the number (or the check) and, beside it, the name, which may take two lines. */
const VERTICAL_ITEM = "flex min-w-0 flex-1 items-start gap-3 text-left";
const STEP_BUTTON =
  "group/step rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:min-h-11";

/** The steps before the current one are done, the ones after it are still to do. */
function stateOf(position: number, current: number): StepState {
  if (position < current) return "done";
  return position === current ? "current" : "todo";
}

/** The number of a step in its circle, or the check of a done one. Drawn for the eyes: the state is said in words beside it. */
function StepMark({ state, position }: { state: StepState; position: number }) {
  return (
    <span aria-hidden="true" className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", NUMBER[state])}>
      {state === "done" ? <Check className="size-3.5" /> : position + 1}
    </span>
  );
}

/**
 * The steps of a flow (a wizard). On a phone it is one line, "Step 2 of 6", the name of the step and a bar; from `md` up
 * it shows every step with its state. The state is never only color: done steps have a check, and each step says "done",
 * "current step" or "to do" to screen readers; the current one is `aria-current="step"`. `orientation="vertical"` lists the
 * steps one under the other, for a column beside the content.
 */
export function Stepper({ steps, current, onStepSelect, label, orientation = "horizontal", className }: StepperProps) {
  const { t } = useTranslation();
  if (steps.length === 0) return null;

  const index = Math.min(Math.max(Math.trunc(current) || 0, 0), steps.length - 1);
  const stepOf = t("ui.stepper.stepOf", { current: index + 1, total: steps.length });
  const stateTextOf = (state: StepState) =>
    state === "done" ? t("ui.stepper.done") : state === "current" ? t("ui.stepper.current") : t("ui.stepper.todo");

  if (orientation === "vertical") {
    return (
      <div className={className} data-orientation="vertical">
        <p className="text-sm font-semibold">{stepOf}</p>
        <ol aria-label={label ?? t("ui.stepper.label")} className="mt-3">
          {steps.map((step, position) => {
            const state = stateOf(position, index);
            const content = (
              <>
                <StepMark state={state} position={position} />
                {/* The name is not cut here: the column has room for a second line. */}
                <span className={cn("min-w-0 break-words py-0.5 text-sm font-semibold group-hover/step:underline", LABEL[state])}>
                  {step.label}
                  <span className="sr-only">{` (${stateTextOf(state)})`}</span>
                </span>
              </>
            );

            return (
              <li key={step.id} className="relative flex min-w-0 pb-6 last:pb-0">
                {/* The line down to the next step: in the color of the bar, full once the step is done. */}
                {position < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn("absolute bottom-1 left-3 top-7 w-0.5 -translate-x-1/2 rounded-full", state === "done" ? BAR.done : BAR.todo)}
                  />
                ) : null}
                {state === "done" && onStepSelect ? (
                  <button type="button" onClick={() => onStepSelect(position)} className={cn(VERTICAL_ITEM, STEP_BUTTON)}>
                    {content}
                  </button>
                ) : (
                  <div aria-current={state === "current" ? "step" : undefined} className={VERTICAL_ITEM}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Phone: the same information in one line. Hidden with CSS (`display: none`), so assistive technology reads one version. */}
      <div className="space-y-2 md:hidden">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 font-semibold">{stepOf}</span>
          <span className="min-w-0 truncate text-muted-foreground">{steps[index].label}</span>
        </div>
        <Progress size="sm" value={((index + 1) / steps.length) * 100} label={stepOf} valueText={stepOf} />
      </div>

      <ol aria-label={label ?? t("ui.stepper.label")} className="hidden gap-2 md:flex">
        {steps.map((step, position) => {
          const state = stateOf(position, index);
          const content = (
            <>
              <span aria-hidden="true" className={cn("h-1 w-full rounded-full", BAR[state])} />
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <StepMark state={state} position={position} />
                <span className={cn("min-w-0 truncate group-hover/step:underline", LABEL[state])} title={step.label}>
                  {step.label}
                  {/* In the same text as the label, so the name reads "Dati (done)" in every browser, as the wizards of the app already do. */}
                  <span className="sr-only">{` (${stateTextOf(state)})`}</span>
                </span>
              </span>
            </>
          );

          return (
            <li key={step.id} className="flex min-w-0 flex-1">
              {state === "done" && onStepSelect ? (
                <button type="button" onClick={() => onStepSelect(position)} className={cn(ITEM, STEP_BUTTON)}>
                  {content}
                </button>
              ) : (
                <div aria-current={state === "current" ? "step" : undefined} className={ITEM}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
