import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Circle, Info, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';
import { formatAbsolute, formatRelative } from './timeline-time';

/** How an event weighs: the colors, the icon and the word of the status badges (`StatusBadge`), so that it is never only a color. */
export type TimelineTone = StatusTone;

export interface TimelineEvent {
  id: string;
  /** When it happened (or will): an instant in ISO 8601, `2026-10-16T09:30:00Z`. */
  at: string;
  /** What happened, already translated: one short line. */
  title: string;
  description?: string;
  /** Who did it ("Giulia", "CasaZen", "L'ospite"), already translated. */
  actor?: string;
  /** Default `neutral`. */
  tone?: TimelineTone;
  /** Replaces the icon of the tone. */
  icon?: LucideIcon;
  /** An address of the app (`/app/short-rent/bookings/3f2a`): the title becomes a link to the thing it is about. */
  href?: string;
}

export interface TimelineProps {
  events: readonly TimelineEvent[];
  /** `desc`: the latest first (default). `asc`: the oldest first. */
  order?: 'desc' | 'asc';
  /** How many events are shown before "Mostra altri"; also how many each press adds. Default 5; `Infinity` shows them all. */
  limit?: number;
  /** The name of the list for a screen reader. Default: "Cronologia". */
  label?: string;
  /** What to say when there is nothing yet. */
  emptyText?: string;
  className?: string;
  testId?: string;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_TONE: TimelineTone = 'neutral';
const TICK_MS = 60_000;

const TONE_ICONS: Record<TimelineTone, LucideIcon> = {
  neutral: Circle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

/** The thing the title leads to: a page of the app. Anything else (`javascript:`, another site, `//host`) is not made a link. */
const isAppPath = (href: string) => href.startsWith('/') && !href.startsWith('//') && !href.includes('\\');

/** The time now, again every minute: "3 minutes ago" does not stay "now" in a drawer that is left open. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface SortedEvent {
  event: TimelineEvent;
  time: Date | null;
}

function sortEvents(events: readonly TimelineEvent[], order: 'desc' | 'asc'): SortedEvent[] {
  const dated = events.map((event) => {
    const time = new Date(event.at);
    return { event, time: Number.isNaN(time.getTime()) ? null : time };
  });
  const direction = order === 'asc' ? 1 : -1;
  // An event whose date cannot be read goes last in either order; for the others the sort is stable (equal times keep the order given).
  return dated.sort((a, b) => {
    if (!a.time || !b.time) return a.time ? -1 : b.time ? 1 : 0;
    return direction * (a.time.getTime() - b.time.getTime());
  });
}

/**
 * What happened, in order (UI-15): a vertical line of events, each with its icon, its title, a line of detail, the time and who
 * did it. The time is told twice, as the date and the hour in Rome ("16 ott, 11:30") and as how long ago ("2 ore fa", up to a
 * week), both inside a `<time>`. The tone of an event (`success`, `warning`, `danger`, `info`) is its color, its icon and a word
 * for a screen reader, never the color alone. Past `limit` events a "Mostra altri" button adds more, and puts the focus on the
 * first of them.
 *
 *     <Timeline events={[{ id: 'paid', at: '2026-10-16T09:30:00Z', title: 'Pagamento ricevuto', tone: 'success' }]} />
 *
 * It tells what the page gives it: the texts come already translated, and no personal data is put in them by the timeline.
 */
export function Timeline({ events, order = 'desc', limit = DEFAULT_LIMIT, label, emptyText, className, testId }: TimelineProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const step = Math.max(1, limit);
  const [shownCount, setShownCount] = useState(step);
  // The event that takes the focus when "Mostra altri" adds some: the first of the new ones. A callback ref focuses it once, when it mounts.
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusOnMount = useCallback((element: HTMLLIElement | null) => element?.focus({ preventScroll: true }), []);

  const sorted = useMemo(() => sortEvents(events, order), [events, order]);

  if (sorted.length === 0) {
    return (
      <p data-testid={testId ?? 'timeline-empty'} className={cn('text-sm text-foreground/70', className)}>
        {emptyText ?? t('detailDrawer.timeline.empty')}
      </p>
    );
  }

  const visible = sorted.slice(0, shownCount);
  const hidden = sorted.length - visible.length;

  return (
    <div className={cn('min-w-0', className)} data-testid={testId}>
      <ol role="list" aria-label={label ?? t('detailDrawer.timeline.label')} className="flex list-none flex-col">
        {visible.map(({ event, time }, index) => {
          const tone = event.tone ?? DEFAULT_TONE;
          const Icon = event.icon ?? TONE_ICONS[tone];
          const toneWord = tone === DEFAULT_TONE ? null : t(`detailDrawer.timeline.tone.${tone}`);
          const relative = time ? formatRelative(time, now, i18n.language) : null;
          return (
            <li
              key={event.id}
              ref={event.id === focusId ? focusOnMount : undefined}
              tabIndex={event.id === focusId ? -1 : undefined}
              data-tone={tone}
              className="relative flex gap-3 pb-5 outline-none last:pb-0"
            >
              {/* The line that joins this event to the next one. */}
              {index < visible.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-3 top-7 w-px -translate-x-1/2 bg-border" /> : null}
              <span aria-hidden="true" className={cn('relative flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset', STATUS_TONE_CLASSES[tone])}>
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium leading-6 text-foreground">
                  {toneWord ? <span className="sr-only">{toneWord}: </span> : null}
                  {event.href && isAppPath(event.href) ? (
                    <Link to={event.href} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {event.title}
                    </Link>
                  ) : (
                    event.title
                  )}
                </p>
                {event.description ? <p className="mt-0.5 break-words text-sm text-foreground/70">{event.description}</p> : null}
                <p className="mt-0.5 break-words text-xs text-foreground/70">
                  {time ? (
                    <time dateTime={time.toISOString()}>
                      {formatAbsolute(time, now, i18n.language)}
                      {relative ? ` · ${relative}` : ''}
                    </time>
                  ) : null}
                  {event.actor ? `${time ? ' · ' : ''}${t('detailDrawer.timeline.by', { actor: event.actor })}` : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {hidden > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          data-testid="timeline-show-more"
          onClick={() => {
            setFocusId(sorted[shownCount]?.event.id ?? null);
            setShownCount((count) => count + step);
          }}
        >
          {t('detailDrawer.timeline.showMore', { count: Math.min(step, hidden) })}
        </Button>
      ) : null}
    </div>
  );
}
