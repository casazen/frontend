import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { PRESS_FEEDBACK } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "soft" | "danger-outline";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
  loading?: boolean;
  iconRight?: React.ReactNode;
  block?: boolean;
}

const SOFT_BG =
  "bg-[color:var(--color-primary-soft,color-mix(in_oklab,var(--color-primary)_10%,var(--color-background)))]";
const SOFT_TEXT = "text-[color:var(--color-primary-text,var(--color-primary))]";
const SOFT_HOVER_BG = "hover:bg-[color:color-mix(in_oklab,var(--color-primary)_14%,var(--color-background))]";
const DANGER_TEXT = "text-[color:var(--color-danger-foreground,#b4232a)]";

const variantStyles = {
  default: "shadow-sm bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
  soft: cn(SOFT_BG, SOFT_TEXT, SOFT_HOVER_BG),
  "danger-outline": cn("border border-destructive/40 bg-background hover:bg-destructive/10", DANGER_TEXT),
};

const sizeStyles = {
  default: "h-10 px-4 py-2 pointer-coarse:min-h-11",
  sm: "h-9 rounded-md px-3 pointer-coarse:min-h-11",
  lg: "h-11 rounded-md px-8",
  icon: "h-10 w-10 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      loading = false,
      iconRight,
      block = false,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-[color,background-color,border-color,text-decoration-color,fill,stroke,scale] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      variant !== "link" && PRESS_FEEDBACK,
      variantStyles[variant],
      sizeStyles[size],
      block && "w-full",
      loading && "cursor-progress",
      className
    );

    const handlers = {
      "aria-busy": loading || undefined,
      "aria-disabled": loading || undefined,
      onClick: loading ? (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault() : onClick,
    };

    const spinner = loading ? (
      <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
    ) : null;
    const trailing = iconRight ? (
      <span aria-hidden="true" className="inline-flex shrink-0 items-center [&>svg]:size-4">
        {iconRight}
      </span>
    ) : null;

    if (!spinner && !trailing) {
      const Comp = asChild ? Slot : "button";
      return (
        <Comp className={classes} ref={ref} {...handlers} {...props}>
          {children}
        </Comp>
      );
    }

    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...handlers} {...props}>
          {spinner}
          <Slottable>{children}</Slottable>
          {trailing}
        </Slot>
      );
    }

    return (
      <button className={classes} ref={ref} {...handlers} {...props}>
        {spinner}
        {children}
        {trailing}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
