import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { StatusKind, StatusOf, StatusPerspective } from "@/lib/status-dictionary";
import { StatusBadge } from "./status-badge";
import { getStatusView } from "./status-view";

export interface StatusExplainerProps<K extends StatusKind> {
  kind: K;
  status: StatusOf<K>;
  perspective?: StatusPerspective;
  /** A line instead of a block: the state, the next one and the sentence, with what is missing inside it. */
  compact?: boolean;
  done?: ReadonlyArray<number>;
  explain?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** "I documenti richiesti" inside a sentence becomes "i documenti richiesti"; "CIN mancante" keeps its capitals. */
function lowerFirst(text: string): string {
  return text.length > 1 && text[0] !== text[0].toLowerCase() && text[1] === text[1].toLowerCase() ? text[0].toLowerCase() + text.slice(1) : text;
}

export function StatusExplainer<K extends StatusKind>({ kind, status, perspective = "host", compact = false, done = [], explain, actions, className }: StatusExplainerProps<K>) {
  const { t, i18n } = useTranslation();
  const view = getStatusView(kind, status, perspective, t, i18n);
  const own = explain !== undefined;
  const sentence = own ? explain : view.explain;
  const next = own ? null : view.next;
  const need = own ? [] : view.need;
  const missing = need.filter((_, index) => !done.includes(index));

  const nextBadge = next ? (
    <>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">{t("status.explainer.next")}</span>
      <span className="inline-flex max-w-full items-center rounded-full px-3 py-1 text-sm font-semibold text-foreground ring-1 ring-inset ring-border">
        <span className="min-w-0 break-words">{next.label}</span>
      </span>
    </>
  ) : null;

  if (compact) {
    return (
      <div className={cn("min-w-0 space-y-1.5", className)} data-status-explainer="compact">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind={kind} status={status} perspective={perspective} />
          {next && (
            <>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">{t("status.explainer.next")}</span>
              <span className="min-w-0 break-words text-sm font-medium">{next.label}</span>
            </>
          )}
        </div>
        {(sentence || (next && missing.length > 0)) && (
          <p className="break-words text-sm">
            {sentence}
            {next && missing.length > 0 && (
              <>
                {" "}
                <strong>{t("status.explainer.compactNeed", { next: next.label })}</strong> {missing.map(lowerFirst).join("; ")}.
              </>
            )}
          </p>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 space-y-3", className)} data-status-explainer="full">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind={kind} status={status} perspective={perspective} size="lg" />
        {nextBadge}
      </div>
      {sentence && <p className="break-words text-sm">{sentence}</p>}
      {next && need.length > 0 && (
        <div className="space-y-2">
          <p className="break-words text-sm font-semibold">{t("status.explainer.need", { next: next.label })}</p>
          <ul className="space-y-1.5" role="list">
            {need.map((item, index) => {
              const isDone = done.includes(index);
              return (
                <li key={item} className="flex min-w-0 items-start gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-inset",
                      isDone ? "bg-success-soft text-success-foreground ring-success-border" : "bg-background ring-border"
                    )}
                  >
                    {isDone && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 break-words">{item}</span>
                  <span className="sr-only">{`(${isDone ? t("status.explainer.itemDone") : t("status.explainer.itemTodo")})`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
