import * as React from "react";
import { Link, type To } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, CheckCircle2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WizardDoneTone = "attention" | "problem";

const TONE_CLASS: Record<WizardDoneTone, string> = {
  attention: "text-[color:var(--color-warning-foreground,#8a4b05)]",
  problem: "text-[color:var(--color-danger-foreground,#b4232a)]",
};

export interface WizardDoneAction {
  label: string;
  to: To;
}

export interface WizardDoneProps {
  title: string;
  description?: string;
  lead?: string;
  whatNext: ReadonlyArray<{ text: string; icon?: LucideIcon; tone?: WizardDoneTone }>;
  primary: WizardDoneAction;
  secondary?: WizardDoneAction;
  className?: string;
  children?: React.ReactNode;
}

export function WizardDone({ title, description, lead, whatNext, primary, secondary, className, children }: WizardDoneProps) {
  const { t } = useTranslation();
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const titleId = React.useId();
  const whatNextId = React.useId();

  React.useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={titleId} className={cn("mx-auto w-full min-w-0 max-w-2xl space-y-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-8", className)}>
      <div className="flex min-w-0 flex-col items-start gap-3">
        <span className="grid size-14 place-items-center rounded-2xl bg-success-soft text-success-foreground">
          <CheckCircle2 aria-hidden="true" className="size-8" />
        </span>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="break-words text-3xl font-semibold tracking-tight outline-none">
          {title}
        </h2>
        {description && <p className="break-words text-muted-foreground">{description}</p>}
        {lead && <p className="max-w-prose break-words text-base">{lead}</p>}
      </div>

      <section aria-labelledby={whatNextId} className="space-y-3 border-y py-5">
        <h3 id={whatNextId} className="text-base font-semibold">
          {t("wizard.done.whatNext")}
        </h3>
        <ul className="space-y-2" role="list">
          {whatNext.map(({ text, icon: Icon = Check, tone }) => (
            <li key={text} className="flex min-w-0 items-start gap-2 text-sm" data-tone={tone ?? "done"}>
              <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone ? TONE_CLASS[tone] : "text-success-foreground")} />
              <span className="min-w-0 break-words">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {children}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight">
          <Link to={primary.to} data-testid="wizard-done-primary">
            {primary.label}
          </Link>
        </Button>
        {secondary && (
          <Button asChild size="lg" variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight">
            <Link to={secondary.to} data-testid="wizard-done-secondary">
              {secondary.label}
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
