import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `soft` is the accent of the area in a light tint (the secondary action next to a primary one); `danger-outline` is
   * the destructive action that is not the main one of the page (the filled `destructive` is for the confirmation).
   */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "soft" | "danger-outline";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
  /**
   * Work in progress: a spinner goes before the label, the button announces `aria-busy` and ignores clicks (and the
   * submit of its form). It stays focusable, so the person who pressed it does not lose their place, and it keeps its
   * label: the label can say what is going on ("Saving...").
   */
  loading?: boolean;
  /** Icon after the label. Decorative (hidden from assistive technology): the label says what the button does. */
  iconRight?: React.ReactNode;
  /** Takes the whole width of its container (forms on a phone, cards). */
  block?: boolean;
}

// `soft` and `danger-outline` read semantic tokens that the redesign defines (`--color-primary-soft`, `--color-primary-text`,
// `--color-danger-foreground`). Until they exist, the fallbacks derive the same thing from the tokens of today: the tint of the
// primary on the page background (text 4.9:1, 4.7:1 on hover) and a red that meets AA on white (6.5:1).
const SOFT_BG =
  "bg-[color:var(--color-primary-soft,color-mix(in_oklab,var(--color-primary)_10%,var(--color-background)))]";
const SOFT_TEXT = "text-[color:var(--color-primary-text,var(--color-primary))]";
const SOFT_HOVER_BG = "hover:bg-[color:color-mix(in_oklab,var(--color-primary)_14%,var(--color-background))]";
const DANGER_TEXT = "text-[color:var(--color-danger-foreground,#b4232a)]";

const variantStyles = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
  soft: cn(SOFT_BG, SOFT_TEXT, SOFT_HOVER_BG),
  "danger-outline": cn("border border-destructive/40 bg-background hover:bg-destructive/10", DANGER_TEXT),
};

// Touch screens get at least 44 px (WCAG 2.5.5, product rule); mouse and keyboard keep the sizes they always had.
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
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      variantStyles[variant],
      sizeStyles[size],
      block && "w-full",
      loading && "cursor-progress",
      className
    );

    // While it works the button ignores the click, but it is not `disabled`: a disabled button drops the focus of the
    // person who has just pressed it. A native submit is cancelled together with the click, so the form is not sent twice.
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

    // Nothing to add around the label: render what the button has always rendered.
    if (!spinner && !trailing) {
      const Comp = asChild ? Slot : "button";
      return (
        <Comp className={classes} ref={ref} {...handlers} {...props}>
          {children}
        </Comp>
      );
    }

    if (asChild) {
      // `Slottable` puts the spinner and the icon inside the element that receives the button (a link, a router link).
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
