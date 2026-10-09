import * as React from "react";
import { Link, type To } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Where an action of the confirmation goes. `label` says what it does ("Open the property"), already translated. */
export interface WizardDoneAction {
  label: string;
  to: To;
}

export interface WizardDoneProps {
  /** The confirmation: what was done ("Property created"). */
  title: string;
  /** A line under it, if it adds something (the name of what was created). */
  description?: string;
  /** What happens now, in two or three short points. Only true things: what the system does, and what is still up to the person. */
  whatNext: ReadonlyArray<{ text: string; icon?: LucideIcon }>;
  /** The recommended next step: toward the thing that was created. */
  primary: WizardDoneAction;
  /** The other thing the person is likely to want. */
  secondary: WizardDoneAction;
  className?: string;
}

/**
 * The last screen of a guided flow: it confirms what was done, says "What happens now" and offers two ways on, the main
 * one toward what was just created. There is no dead end: both actions are links. The focus goes to the confirmation
 * when the screen opens, so a screen reader reads it.
 */
export function WizardDone({ title, description, whatNext, primary, secondary, className }: WizardDoneProps) {
  const { t } = useTranslation();
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const titleId = React.useId();
  const whatNextId = React.useId();

  React.useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={titleId} className={cn("mx-auto w-full min-w-0 max-w-xl space-y-6", className)}>
      <div className="flex min-w-0 flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success-foreground">
          <CheckCircle2 aria-hidden="true" className="size-8" />
        </span>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="break-words text-2xl font-semibold tracking-tight outline-none">
          {title}
        </h2>
        {description && <p className="break-words text-muted-foreground">{description}</p>}
      </div>

      <section aria-labelledby={whatNextId} className="space-y-3 rounded-lg bg-muted p-4">
        <h3 id={whatNextId} className="text-base font-semibold">
          {t("wizard.done.whatNext")}
        </h3>
        <ul className="space-y-2" role="list">
          {whatNext.map(({ text, icon: Icon = Check }) => (
            <li key={text} className="flex min-w-0 items-start gap-2 text-sm">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" />
              <span className="min-w-0 break-words">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight">
          <Link to={primary.to} data-testid="wizard-done-primary">
            {primary.label}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight">
          <Link to={secondary.to} data-testid="wizard-done-secondary">
            {secondary.label}
          </Link>
        </Button>
      </div>
    </section>
  );
}
