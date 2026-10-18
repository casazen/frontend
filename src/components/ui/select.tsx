import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** `sm` is for toolbars and filters (36 px). */
  size?: "default" | "sm";
  /** Same as `aria-invalid`; a `Field` with an error sets `aria-invalid` for you. */
  invalid?: boolean;
  /** Classes of the box around the `<select>`: its width in a toolbar (`w-48`), margins. `className` goes on the `<select>`. */
  wrapperClassName?: string;
}

// The red state needs more than the border: a global rule makes the `border-*` color utilities do nothing today, so
// the invalid field also gets a 1 px outline right over its border.
const INVALID =
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:outline aria-[invalid=true]:outline-1 aria-[invalid=true]:-outline-offset-1 aria-[invalid=true]:outline-destructive";

/**
 * The native `<select>` with the look of the other fields (same border, height and focus ring as `Input`) and an arrow
 * that follows the text color. It is not a listbox: the browser draws the options, which is what a phone does best, and
 * `register(...)`, `value`/`onChange`, `Field` and every attribute of `<select>` work as always.
 *
 * Heights are the ones of `Input` (40 px, 36 px for `sm`) so a select next to an input lines up. The 44 px minimum of the
 * fields on a touch screen is one rule for all of them (input, select, textarea), not a class of this component.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, size = "default", invalid, children, ...props }, ref) => (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "peer block w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "h-9 py-1" : "h-10 py-2",
          INVALID,
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground peer-disabled:opacity-50"
      />
    </div>
  )
);
Select.displayName = "Select";

export { Select };
