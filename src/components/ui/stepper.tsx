import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  current: number;
  onStepSelect?: (index: number) => void;
  label?: string;
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
  done: "bg-primary/10 text-primary",
  current: "bg-primary text-primary-foreground",
  todo: "bg-background text-muted-foreground ring-1 ring-inset ring-border",
};

const LABEL: Record<StepState, string> = {
  done: "text-muted-foreground",
  current: "text-foreground",
  todo: "text-muted-foreground",
};

const ITEM = "flex min-w-0 flex-1 flex-col gap-2 text-left";
const VERTICAL_ITEM = "flex min-w-0 flex-1 items-start gap-3 text-left";
const STEP_BUTTON =
  "group/step rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:min-h-11";

function stateOf(position: number, current: number): StepState {
  if (position < current) return "done";
  return position === current ? "current" : "todo";
}

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
        <p className="border-b pb-3 text-sm font-semibold tracking-tight text-primary">{stepOf}</p>
        <ol aria-label={label ?? t("ui.stepper.label")} className="mt-4">
          {steps.map((step, position) => {
            const state = stateOf(position, index);
            const content = (
              <>
                <StepMark state={state} position={position} />
                <span className={cn("min-w-0 break-words py-0.5 text-sm font-semibold group-hover/step:underline", LABEL[state])}>
                  {step.label}
                  <span className="sr-only">{` (${stateTextOf(state)})`}</span>
                </span>
              </>
            );

            return (
              <li key={step.id} className="relative flex min-w-0 pb-6 last:pb-0">
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
      <div className="space-y-2 md:hidden">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="shrink-0 font-semibold">{stepOf}</span>
          {onStepSelect && index > 0 ? (
            <select
              aria-label={label ?? t("ui.stepper.label")}
              className="min-h-11 min-w-0 max-w-[65%] rounded-lg border bg-card px-2 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              value={index}
              onChange={(event) => onStepSelect(Number(event.target.value))}
            >
              {steps.slice(0, index + 1).map((item, position) => (
                <option key={item.id} value={position}>{item.label}</option>
              ))}
            </select>
          ) : <span className="min-w-0 break-words text-right text-foreground">{steps[index].label}</span>}
        </div>
        <Progress size="sm" value={((index + 1) / steps.length) * 100} label={stepOf} valueText={stepOf} />
      </div>

      <ol aria-label={label ?? t("ui.stepper.label")} className="hidden flex-wrap gap-x-3 gap-y-2 md:flex">
        {steps.map((step, position) => {
          const state = stateOf(position, index);
          const content = (
            <>
              <span aria-hidden="true" className={cn("h-1 w-full rounded-full", BAR[state])} />
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <StepMark state={state} position={position} />
                <span className={cn("min-w-0 truncate group-hover/step:underline", LABEL[state])} title={step.label}>
                  {step.label}
                  <span className="sr-only">{` (${stateTextOf(state)})`}</span>
                </span>
              </span>
            </>
          );

          return (
            <li key={step.id} className="flex min-w-0 flex-[1_1_7rem]">
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
