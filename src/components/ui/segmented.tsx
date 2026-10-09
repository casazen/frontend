import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string = string> {
  value: T;
  /** What the button says. It may carry a number ("Attivi (3)"). */
  label: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
  testId?: string;
}

export interface SegmentedProps<T extends string> {
  /** The name of the group for a screen reader ("Stato degli immobili", "Vista"). */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  testId?: string;
}

/**
 * A few exclusive choices side by side, for what changes the way the same data is shown or which part of it is shown
 * ("Tutti / Attivi / In pausa", "Elenco / Calendario") (UI-07). Each choice is a button with `aria-pressed`: the one that is
 * pressed is the one in force, and it also looks it, by a raised white tile on the gray track and not only by a color. The
 * Tab key goes through the buttons, Enter and Space press one. Pressing the one already pressed changes nothing.
 *
 * It is not for moving between pages (that is `Tabs`, which are links) and not for a form (that is a group of radio
 * buttons, `ChoiceCard`).
 */
export function Segmented<T extends string>({ label, options, value, onValueChange, className, testId }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none]', className)}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={option.disabled}
            data-testid={option.testId}
            onClick={() => {
              if (!pressed) onValueChange(option.value);
            }}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              // `foreground/65` and not `muted-foreground`: that token is 3.9:1 on the gray track, and a text needs 4.5:1.
              pressed ? 'bg-background text-foreground shadow-sm' : 'text-foreground/65 hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
