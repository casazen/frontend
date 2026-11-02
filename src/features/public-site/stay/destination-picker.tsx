import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, MapPin } from 'lucide-react';
import './stay-pickers.css';

/** A place the guest can look for homes in: a zone where the host has some (`DB-07a` lists them for a site). */
export interface Destination {
  id: string;
  label: string;
  /** A few words under the name ("Mare, campagna e città"). */
  sub?: string;
  icon?: ReactNode;
}

export interface DestinationPickerProps {
  destinations: readonly Destination[];
  /** The id of the destination chosen; empty for "all". */
  value: string;
  onChange: (id: string) => void;
  /** The first line, "everything" (default: all the destinations of the site). */
  allLabel?: string;
  allSub?: string;
  /** Names the list for a screen reader. */
  label: string;
}

/**
 * The places to choose from: "all" first, then each zone with its home count or its few words (DB-20). A list of options (`listbox`):
 * the arrows move from one to the next, Home and End go to the ends, a click or Enter chooses. What is chosen is marked by a
 * thick outline and `aria-selected`, never by a color alone.
 */
export function DestinationPicker({ destinations, value, onChange, allLabel, allSub, label }: DestinationPickerProps) {
  const { t } = useTranslation();
  const list = useRef<HTMLDivElement>(null);

  const options: Destination[] = [
    { id: '', label: allLabel ?? t('stayPickers.destination.all'), sub: allSub ?? t('stayPickers.destination.allSub'), icon: <Compass aria-hidden="true" /> },
    ...destinations,
  ];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const target: Record<string, number> = {
      ArrowDown: Math.min(buttons.length - 1, current + 1),
      ArrowUp: Math.max(0, current - 1),
      Home: 0,
      End: buttons.length - 1,
    };
    if (!(event.key in target) || current < 0) return;
    event.preventDefault();
    buttons[target[event.key]]?.focus();
  };

  return (
    <div ref={list} role="listbox" aria-label={label} className="stay-dests" onKeyDown={handleKeyDown} data-testid="destination-picker">
      {options.map((option) => (
        <button
          key={option.id || 'all'}
          type="button"
          role="option"
          aria-selected={value === option.id}
          className="stay-dest"
          onClick={() => onChange(option.id)}
          data-value={option.id}
        >
          <span className="stay-dest__icon">{option.icon ?? <MapPin aria-hidden="true" />}</span>
          <span className="stay-dest__text">
            <strong>{option.label}</strong>
            {option.sub ? <small>{option.sub}</small> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
