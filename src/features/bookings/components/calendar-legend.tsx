import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CALENDAR_KINDS } from '../lib/calendar-kinds';

/**
 * What the colors and the shapes of the calendar mean: one small copy of an event for each kind, with its icon and its name,
 * so that nothing is told by color alone. On a computer it is always there; on a phone it takes a line and opens on demand.
 */
export function CalendarLegend() {
  const { t } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div data-testid="calendar-legend">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-foreground/70 hover:text-foreground md:hidden"
      >
        {t('booking.calendar.legend.summary')}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <ul
        id={listId}
        aria-label={t('booking.calendar.legend.title')}
        className={cn('flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground/80', open ? 'flex' : 'hidden md:flex')}
      >
        {CALENDAR_KINDS.map(({ kind, icon: Icon, labelKey }) => (
          <li key={kind} className="inline-flex min-w-0 items-center gap-2">
            <span className={cn('host-calendar-swatch', `host-calendar-event--${kind}`)} aria-hidden="true">
              <Icon />
            </span>
            {t(labelKey)}
          </li>
        ))}
      </ul>
    </div>
  );
}
