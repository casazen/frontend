import * as React from 'react';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChoiceCardProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'title' | 'className'> {
  /** One choice among several (radio, default) or one of many that can be chosen together (checkbox). */
  type?: 'radio' | 'checkbox';
  /** What is chosen, in a few words. */
  title: React.ReactNode;
  /** What it means, in a line. */
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** For the card (the label), not for the input. */
  className?: string;
}

/**
 * A choice that takes space and says what it is: an icon, a title, a line of explanation (UI-07). Under it there is a real
 * `<input type="radio">` or `<input type="checkbox">`, only not drawn: the name, the value, the keyboard (arrows in a group
 * of radios, Space on a checkbox), the form and `react-hook-form` work as with any input; the card is its label.
 *
 * What is chosen shows in more than one way, so that it does not depend on seeing a color: a thick outline, a tinted
 * background and a tick in the corner that is empty when not chosen. The one with the keyboard focus has its own outline.
 *
 * Put them in a `ChoiceGroup`, which is the `fieldset` and names the question.
 */
export const ChoiceCard = React.forwardRef<HTMLInputElement, ChoiceCardProps>(function ChoiceCard(
  { type = 'radio', title, description, icon: Icon, className, ...input },
  ref,
) {
  return (
    <label
      className={cn(
        'relative flex min-h-11 min-w-0 cursor-pointer flex-col gap-2 rounded-xl border bg-background p-4 pr-11 text-left transition-colors hover:bg-muted/40',
        'has-checked:bg-primary/5 has-checked:ring-2 has-checked:ring-primary',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        'has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:bg-background',
        className,
      )}
    >
      <input ref={ref} type={type} className="peer sr-only" {...input} />
      {Icon ? (
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground"
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <span className="break-words font-semibold leading-snug">{title}</span>
      {/* `foreground/70` and not `muted-foreground`: that token is 4.1:1 on the tint of a chosen card, a text needs 4.5:1. */}
      {description ? <span className="break-words text-sm text-foreground/70">{description}</span> : null}
      {/* The tick: a disc for one choice, a square for several; empty until chosen. Not read: the input says it. An inset ring,
          not a border: the border color of every element is fixed by a rule of `globals.css` that the utilities cannot beat. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-3 top-3 grid h-6 w-6 place-items-center text-transparent ring-2 ring-inset ring-muted-foreground transition-colors',
          'peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:ring-primary',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </label>
  );
});

export interface ChoiceGroupProps {
  /** The question the cards answer ("Come vuoi pubblicare il sito?"). It names the group for a screen reader. */
  legend: React.ReactNode;
  /** Show the question above the cards. Default: it is only for screen readers (the page usually says it already). */
  legendVisible?: boolean;
  /** The narrowest a card may get, in `rem`, before the cards move to a new row. Default 11. */
  minCardWidth?: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * The `fieldset` of a set of `ChoiceCard`s: the question, and the cards in a grid that shares the row among them (two cards
 * are two halves, not two narrow strips) and wraps to the next row when they would get narrower than `minCardWidth`.
 */
export function ChoiceGroup({ legend, legendVisible = false, minCardWidth = 11, children, className }: ChoiceGroupProps) {
  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', className)}>
      <legend className={legendVisible ? 'mb-2 text-sm font-medium' : 'sr-only'}>{legend}</legend>
      <div
        className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--choice-min)),1fr))]"
        style={{ '--choice-min': `${minCardWidth}rem` } as React.CSSProperties}
      >
        {children}
      </div>
    </fieldset>
  );
}
