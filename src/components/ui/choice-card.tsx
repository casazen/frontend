import * as React from 'react';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TILE_PRESS_FEEDBACK } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface ChoiceCardProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'title' | 'className'> {
  type?: 'radio' | 'checkbox';
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** A picture or any other content shown in place of the icon (a photo of the house). Decorative: the title says what is chosen. */
  media?: React.ReactNode;
  /** For the card (the label), not for the input. */
  className?: string;
}

/**
 * A choice that takes space and says what it is: an icon, a title, a line of explanation (UI-07). Under it there is a real
 * `<input type="radio">` or `<input type="checkbox">`, only not drawn: the name, the value, the keyboard (arrows in a group
 * of radios, Space on a checkbox), the form and `react-hook-form` work as with any input; the card is its label.
 *
 * What is chosen shows in more than one way, so that it does not depend on seeing a color: a thick dark outline, a grey
 * background and a dark tick in the corner that is empty when not chosen (the ink of the text, not the accent of the area: a
 * choice reads the same in every area, as in the flows the product takes after; the accent stays for the buttons). The tile
 * sinks a little under the finger. The one with the keyboard focus has its own outline.
 *
 * Put them in a `ChoiceGroup`, which is the `fieldset` and names the question.
 */
export const ChoiceCard = React.forwardRef<HTMLInputElement, ChoiceCardProps>(function ChoiceCard(
  { type = 'radio', title, description, icon: Icon, media, className, ...input },
  ref,
) {
  return (
    <label
      className={cn(
        'relative flex min-h-11 min-w-0 cursor-pointer flex-col gap-2 rounded-xl border bg-background p-4 pr-11 text-left transition-[background-color,box-shadow,scale] duration-150 hover:bg-muted/40',
        TILE_PRESS_FEEDBACK,
        'has-checked:bg-muted/60 has-checked:ring-2 has-checked:ring-foreground',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        'has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:bg-background',
        className,
      )}
    >
      <input ref={ref} type={type} className="peer sr-only" {...input} />
      {media ? (
        <span aria-hidden="true" className="block overflow-hidden rounded-lg">
          {media}
        </span>
      ) : Icon ? (
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-foreground/70 transition-colors peer-checked:bg-foreground peer-checked:text-background"
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <span className="break-words font-semibold leading-snug">{title}</span>
      {description ? <span className="break-words text-sm text-foreground/70">{description}</span> : null}
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-3 top-3 grid h-6 w-6 place-items-center text-transparent ring-2 ring-inset ring-muted-foreground transition-colors',
          'peer-checked:bg-foreground peer-checked:text-background peer-checked:ring-foreground',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </label>
  );
});

export interface ChoiceGroupProps {
  legend: React.ReactNode;
  legendVisible?: boolean;
  minCardWidth?: number;
  children: React.ReactNode;
  className?: string;
}

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
