import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useOptionalWizard } from "./wizard-context";

export interface WizardSummaryItem {
  id: string;
  /** What the answer is ("Fiscal regime"). */
  label: string;
  /** The answer, as it should read. Empty (`null`, `""`) shows "Not provided". */
  value: React.ReactNode;
  /** The step where the answer is given: the row gets a "Edit" link that goes back to it. */
  stepId?: string;
}

export interface WizardSummaryProps {
  items: ReadonlyArray<WizardSummaryItem>;
  className?: string;
}

/**
 * The answers so far, before the last button: a list of what was asked and what was answered, each with a link "Edit" that
 * returns to its step (the answers are kept). Inside a `WizardShell` the links are real links to `?step=`; outside one
 * the summary is read-only.
 */
export function WizardSummary({ items, className }: WizardSummaryProps) {
  const { t } = useTranslation();
  const wizard = useOptionalWizard();

  return (
    <dl className={cn("min-w-0 divide-y rounded-md border", className)}>
      {items.map((item) => {
        const empty = item.value === null || item.value === undefined || item.value === "" || item.value === false;
        return (
          <div key={item.id} className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-4">
            <dt className="break-words text-sm text-muted-foreground">{item.label}</dt>
            <dd className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className={cn("min-w-0 break-words font-medium", empty && "font-normal text-muted-foreground")}>
                {empty ? t("wizard.summary.empty") : item.value}
              </span>
              {item.stepId && wizard && (
                <Link
                  to={wizard.hrefFor(item.stepId)}
                  aria-label={t("wizard.summary.editField", { field: item.label })}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {t("wizard.summary.edit")}
                </Link>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
