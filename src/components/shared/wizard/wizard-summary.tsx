import * as React from "react";
import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useOptionalWizard } from "./wizard-context";

export interface WizardSummaryItem {
  id: string;
  label: string;
  value: React.ReactNode;
  stepId?: string;
}

export interface WizardSummaryProps {
  items: ReadonlyArray<WizardSummaryItem>;
  className?: string;
}

export function WizardSummary({ items, className }: WizardSummaryProps) {
  const { t } = useTranslation();
  const wizard = useOptionalWizard();

  return (
    <dl className={cn("min-w-0 divide-y rounded-xl border bg-card", className)}>
      {items.map((item) => {
        const empty = item.value === null || item.value === undefined || item.value === "" || item.value === false;
        return (
          <div key={item.id} className="grid min-w-0 gap-0.5 px-4 py-2.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-center sm:gap-5">
            <dt className="break-words text-sm text-muted-foreground">{item.label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className={cn("min-w-0 break-words font-medium", empty && "font-normal text-muted-foreground")}>
                {empty ? t("wizard.summary.empty") : item.value}
              </span>
              {item.stepId && wizard && (
                <Link
                  to={wizard.hrefFor(item.stepId)}
                  aria-label={t("wizard.summary.editField", { field: item.label })}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Pencil aria-hidden="true" className="size-3.5" />
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
