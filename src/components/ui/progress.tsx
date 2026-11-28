import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function toPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  value: number;
  label?: string;
  /** What the value means in words ("Step 2 of 6"): assistive technology reads it instead of the percentage. */
  valueText?: string;
  tone?: "default" | "success";
  size?: "default" | "sm";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, label, valueText, tone = "default", size = "default", className, ...props }, ref) => {
    const { t } = useTranslation();
    const percent = toPercent(value);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={valueText}
        aria-label={label ?? t("ui.progress.label")}
        className={cn("w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2", className)}
        {...props}
      >
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out",
            tone === "success" ? "bg-[color:var(--color-success,#1e8a47)]" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export interface RingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  value: number;
  size?: number;
  label?: string;
}

const RING_STROKE = 5;

const Ring = React.forwardRef<HTMLDivElement, RingProps>(({ value, size = 44, label, className, style, ...props }, ref) => {
  const { t } = useTranslation();
  const percent = toPercent(value);
  const rounded = Math.round(percent);
  const radius = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-label={label ?? t("ui.ring.label", { value: rounded })}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={RING_STROKE} className="stroke-muted" />
        {percent > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300 motion-safe:ease-out"
          />
        )}
      </svg>
      <span aria-hidden="true" className="relative text-[0.6875rem] font-bold tabular-nums">
        {rounded}%
      </span>
    </div>
  );
});
Ring.displayName = "Ring";

export { Progress, Ring };
