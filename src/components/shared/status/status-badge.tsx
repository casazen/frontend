import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { StatusIconName, StatusKind, StatusOf, StatusPerspective, StatusTone } from "@/lib/status-dictionary";
import { STATUS_ICONS } from "./status-icons";
import { getStatusView, STATUS_TONE_CLASSES } from "./status-view";

export interface StatusBadgeProps<K extends StatusKind> extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** What the state is of: `booking`, `lease`, `request`... (see `lib/status-dictionary`). */
  kind: K;
  /** The value the API sent. One the app does not know is shown as it came. */
  status: StatusOf<K>;
  /** Who is looking: a supplier sees a request with other words. Default: the host. */
  perspective?: StatusPerspective;
  size?: "default" | "lg";
  /**
   * The words of this one badge, when the page has better ones than the dictionary: a count («In ritardo di 3 giorni»), a state the server
   * has not told the app yet («Vedi la richiesta»), a phase that is not a state of the API. The tone and the icon stay the state's.
   */
  label?: string;
  /** With `label`, for a phase of a page that is not a state of the dictionary: its own tone. Not for restyling a state that is there. */
  tone?: StatusTone;
  /** The same, for the icon. */
  icon?: StatusIconName;
}

/**
 * The state of a thing: an icon and a word on a soft background. The icon is always there, so the state is never told
 * by color alone. It is a `span`, so it fits in a line of text or in a table cell; a long name wraps instead of
 * pushing the layout.
 *
 *     <StatusBadge kind="lease" status={lease.status} />
 */
export function StatusBadge<K extends StatusKind>({
  kind,
  status,
  perspective = "host",
  size = "default",
  label,
  tone,
  icon,
  className,
  ...props
}: StatusBadgeProps<K>) {
  const { t, i18n } = useTranslation();
  const view = getStatusView(kind, status, perspective, t, i18n);
  const Icon = STATUS_ICONS[icon ?? view.icon];

  return (
    <span
      data-status-kind={kind}
      data-status={status}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full font-semibold ring-1 ring-inset",
        size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        STATUS_TONE_CLASSES[tone ?? view.tone],
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("shrink-0", size === "lg" ? "size-4" : "size-3.5")} />
      <span className="min-w-0 break-words">{label ?? view.label}</span>
    </span>
  );
}
