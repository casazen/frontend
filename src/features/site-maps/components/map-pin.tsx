import { CalendarX } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export interface MapPinProps {
  id: string;
  /** What the pill says: a price, or the name of a zone. */
  label: string;
  /** The whole sentence for a screen reader: name, price, and why the house is not free if it is not. */
  accessibleName: string;
  /** Position in percent of the frame. */
  x: number;
  y: number;
  /** Shift in px to keep pins from sitting on top of each other; never more than the approximation of the position allows. */
  dx?: number;
  dy?: number;
  selected: boolean;
  /** Lit because the same item of the list is hovered or focused. */
  active: boolean;
  /** Emphasised by the page (for instance the house of the page). */
  highlighted: boolean;
  available: boolean;
  onSelect: (id: string) => void;
  onActiveChange?: (id: string | null) => void;
}

const STRIPES: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, var(--cz-public-surface, #fff) 0 5px, color-mix(in srgb, var(--cz-public-muted, #555) 22%, transparent) 5px 10px)',
};

/**
 * A pin of the map: a pill with the price, an interactive element with its own accessible name, reachable with the keyboard
 * (Enter or Space select it). It is grey with stripes and an icon when the house is not free, so that it never relies on
 * colour alone, and it is at least 44 px high. The colours are the tokens of the public site.
 */
export function MapPin({ id, label, accessibleName, x, y, dx = 0, dy = 0, selected, active, highlighted, available, onSelect, onActiveChange }: MapPinProps) {
  const lit = selected || active || highlighted;
  return (
    <li
      className="absolute"
      style={{ left: `calc(${x}% + ${dx}px)`, top: `calc(${y}% + ${dy}px)`, transform: 'translate(-50%, -50%)', zIndex: selected ? 30 : lit ? 20 : available ? 10 : 5 }}
    >
      <button
        type="button"
        aria-label={accessibleName}
        aria-pressed={selected}
        data-pin-id={id}
        data-testid="map-pin"
        data-available={available}
        onClick={() => onSelect(id)}
        onMouseEnter={() => onActiveChange?.(id)}
        onMouseLeave={() => onActiveChange?.(null)}
        onFocus={() => onActiveChange?.(id)}
        onBlur={() => onActiveChange?.(null)}
        style={available ? undefined : lit ? undefined : STRIPES}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-sm font-bold leading-none shadow-md motion-safe:transition-transform',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cz-public-primary-text,#1d4ed8)] focus-visible:ring-offset-2',
          lit
            ? 'scale-110 border-[var(--cz-public-primary,#111)] bg-[var(--cz-public-primary,#111)] text-[var(--cz-public-on-primary,#fff)]'
            : available
              ? 'border-[var(--cz-public-text,#111)] bg-[var(--cz-public-surface,#fff)] text-[var(--cz-public-text,#111)]'
              : 'border-[var(--cz-public-muted,#555)] font-semibold text-[var(--cz-public-muted,#555)]',
        )}
      >
        {available ? null : <CalendarX className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <span aria-hidden="true">{label}</span>
      </button>
    </li>
  );
}
