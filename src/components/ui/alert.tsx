import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  /** A short line in bold above the text. */
  title?: React.ReactNode;
  /** What to do about it: one or two buttons or links (`Button size="sm"`). They go under the text. */
  action?: React.ReactNode;
  /** Replaces the icon of the variant. It is decorative: the title and the text carry the meaning. */
  icon?: LucideIcon;
}

// Colors: the semantic tokens of the redesign (`--color-{info,success,warning,danger}-{soft,border,foreground}`), each with
// the value they have there as a fallback, so the alert looks the same before and after the tokens land. The text of
// the box is the page foreground (18:1 on every soft background); the icon uses the `-foreground` tone (5.8:1 and more).
// The edge is a 1 px inset ring and not a border: a global rule overrides `border-*` colors today.
const VARIANTS: Record<AlertVariant, { box: string; icon: string; Icon: LucideIcon }> = {
  info: {
    box: "bg-[color:var(--color-info-soft,#ecf2fd)] ring-[color:var(--color-info-border,#b9cdf3)]",
    icon: "text-[color:var(--color-info-foreground,#1f4fa8)]",
    Icon: Info,
  },
  success: {
    box: "bg-[color:var(--color-success-soft,#eaf7ee)] ring-[color:var(--color-success-border,#b7e2c3)]",
    icon: "text-[color:var(--color-success-foreground,#166534)]",
    Icon: CheckCircle2,
  },
  warning: {
    box: "bg-[color:var(--color-warning-soft,#fef4e2)] ring-[color:var(--color-warning-border,#f5d49a)]",
    icon: "text-[color:var(--color-warning-foreground,#8a4b05)]",
    Icon: AlertTriangle,
  },
  danger: {
    box: "bg-[color:var(--color-danger-soft,#fdedee)] ring-[color:var(--color-danger-border,#f4b8bb)]",
    icon: "text-[color:var(--color-danger-foreground,#b4232a)]",
    Icon: AlertCircle,
  },
};

/**
 * A notice inside the page. Only `danger` is announced at once (`role="alert"`); the others are `role="status"`, read
 * when the screen reader is idle. A box that is already there when the page opens is not announced either way.
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = "info", title, action, icon, className, children, ...props }, ref) => {
    const { box, icon: iconTone, Icon: VariantIcon } = VARIANTS[variant];
    const Icon = icon ?? VariantIcon;

    return (
      <div
        ref={ref}
        role={variant === "danger" ? "alert" : "status"}
        className={cn("flex min-w-0 items-start gap-3 rounded-md p-3 text-sm leading-relaxed text-foreground ring-1 ring-inset", box, className)}
        {...props}
      >
        <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", iconTone)} />
        <div className="min-w-0 flex-1 break-words">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
          {action && <div className="mt-2 flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export { Alert };
