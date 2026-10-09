import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground",
    // White on green-500 / yellow-500 is 2.2:1 / 1.9:1 (AA asks 4.5:1). The `v2:` classes apply only with the redesign
    // (html[data-ui='v2']): dark text on a soft background with a border, from the semantic tokens (6:1 and more). Without
    // the redesign the badge is as it was, so that the app without the flag does not change (UI-01); UI-10 drops the old classes.
    success:
      "border-transparent bg-green-500 text-white hover:bg-green-600 v2:border-success-border v2:bg-success-soft v2:text-success-foreground",
    warning:
      "border-transparent bg-yellow-500 text-white hover:bg-yellow-600 v2:border-warning-border v2:bg-warning-soft v2:text-warning-foreground",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
