import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status-dictionary";
import { STATUS_TONE_CLASSES } from "./status-view";

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  icon: LucideIcon;
}

export function StatusPill({ tone = "neutral", icon: Icon, className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", STATUS_TONE_CLASSES[tone], className)}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}
