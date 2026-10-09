import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { pipelineIndex, STATUS_PIPELINES, type StatusKind, type StatusOf, type StatusPerspective } from "@/lib/status-dictionary";
import { StatusBadge } from "./status-badge";
import { STATUS_ICONS } from "./status-icons";
import { getStatusView } from "./status-view";

export interface StatusPipelineProps<K extends StatusKind> {
  kind: K;
  status: StatusOf<K>;
  perspective?: StatusPerspective;
  className?: string;
}

type Position = "done" | "current" | "todo";

/** The steps behind the current one are done, the ones ahead are still to do. */
function positionOf(index: number, current: number): Position {
  if (index < current) return "done";
  return index === current ? "current" : "todo";
}

/**
 * Where a thing is on its way: the states it goes through, the ones behind it done, the current one marked, the ones
 * ahead still to do. Done steps have a check, the current one is bold and `aria-current`, and each one says its state in
 * words for a screen reader: the position is never told by color alone. A state off the usual path (cancelled, rejected)
 * is shown by itself. A kind with no path renders nothing.
 */
export function StatusPipeline<K extends StatusKind>({ kind, status, perspective = "host", className }: StatusPipelineProps<K>) {
  const { t, i18n } = useTranslation();
  const steps = STATUS_PIPELINES[kind] as ReadonlyArray<string> | undefined;
  if (!steps) return null;

  const current = pipelineIndex(kind, status);
  if (current < 0) {
    return (
      <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)} data-status-pipeline="off-path">
        <StatusBadge kind={kind} status={status} perspective={perspective} />
        <span className="sr-only">{t("status.pipeline.offPath")}</span>
      </div>
    );
  }

  return (
    <ol aria-label={t("status.pipeline.label")} className={cn("flex min-w-0 flex-wrap gap-2", className)} data-status-pipeline="path">
      {steps.map((step, index) => {
        const view = getStatusView(kind, step, perspective, t, i18n);
        const position = positionOf(index, current);
        const Icon = position === "done" ? Check : STATUS_ICONS[view.icon];
        return (
          <li
            key={step}
            aria-current={position === "current" ? "step" : undefined}
            data-position={position}
            className={cn(
              "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-inset",
              position === "current" && "bg-primary-soft font-semibold text-foreground ring-primary",
              position === "done" && "bg-muted text-foreground ring-border",
              position === "todo" && "bg-background text-foreground ring-border"
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">{view.label}</span>
            <span className="sr-only">{` (${t(`status.pipeline.${position}`)})`}</span>
          </li>
        );
      })}
    </ol>
  );
}
