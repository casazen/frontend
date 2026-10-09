import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface QtyProps {
  /** What is counted ("Adulti", "Camere"). It names the group and the two buttons, and the value when it is read out. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Default 0. */
  min?: number;
  /** Default 99. */
  max?: number;
  /** How much each press adds or takes away. Default 1. */
  step?: number;
  /** With a name the control also puts its value in a form (a hidden field). */
  name?: string;
  disabled?: boolean;
  /** What a screen reader says when the value changes. Default "{label}: {value}". */
  valueText?: (value: number) => string;
  className?: string;
  testId?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A small whole number to raise and lower with two buttons: guests, rooms, beds (UI-07). Two buttons of 44 px with the value
 * between them, instead of a box to type in, which on a phone opens a keyboard for a number that is almost always 1 to 5.
 *
 * It keeps within `min` and `max`: at the limit the button that would go past it is dimmed (`aria-disabled`, not `disabled`,
 * so that the focus does not fall off the button the user is pressing) and does nothing. With the focus on either button the
 * arrows (up and down) also change the value, PageUp and PageDown by ten steps, Home and End go to the limits. The value is a
 * live region: when it changes a screen reader says it ("Adulti: 3") whichever button was pressed.
 */
export function Qty({ label, value, onChange, min = 0, max = 99, step = 1, name, disabled, valueText, className, testId }: QtyProps) {
  const { t } = useTranslation();
  const current = clamp(Number.isFinite(value) ? value : min, min, max);
  const atMin = current <= min;
  const atMax = current >= max;

  const change = (to: number) => {
    if (disabled) return;
    const next = clamp(to, min, max);
    if (next !== current) onChange(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowUp: current + step,
      ArrowDown: current - step,
      PageUp: current + step * 10,
      PageDown: current - step * 10,
      Home: min,
      End: max,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    change(moves[event.key]);
  };

  // The outline of the disc is a ring, not a border: the border color of every element is fixed by a rule of `globals.css`
  // that the utilities cannot beat, and it is too pale to see where to press.
  const buttonClass = cn(
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-inset ring-muted-foreground/70 transition-colors',
    'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-background',
  );

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cn('inline-flex items-center gap-2', className)}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        aria-label={t('qty.decrease', { label })}
        aria-disabled={atMin || disabled ? true : undefined}
        className={buttonClass}
        onClick={() => change(current - step)}
      >
        <Minus className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      <output aria-live="polite" aria-atomic="true" className="min-w-[2.5ch] text-center text-lg font-semibold tabular-nums">
        <span aria-hidden="true">{current}</span>
        <span className="sr-only">{valueText ? valueText(current) : `${label}: ${current}`}</span>
      </output>
      <button
        type="button"
        aria-label={t('qty.increase', { label })}
        aria-disabled={atMax || disabled ? true : undefined}
        className={buttonClass}
        onClick={() => change(current + step)}
      >
        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      {name ? <input type="hidden" name={name} value={current} /> : null}
    </div>
  );
}
