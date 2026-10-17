import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarOff, Loader2 } from 'lucide-react';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { PROPERTIES_PATH, propertyTabPath } from '@/features/properties/properties-paths';
import { todayInRome } from '@/lib/stay-dates';
import { useHostCalendar } from '@/queries/use-host-calendar';
import type { HostCalendarItem } from '@/types/host-calendar.types';
import { TIMELINE_KINDS } from '../lib/calendar-kinds';
import { buildTimelineRows, drawerKindOf, timelineDays, timelineQuery } from '../lib/host-timeline';
import { CalendarLegend } from './calendar-legend';
import { HostTimeline } from './host-timeline';

const BOOKINGS_PATH = '/app/short-rent/bookings';

interface TimelineSectionProps {
  /** First day shown. */
  start: string;
  /** How many days. */
  zoom: number;
  /** One property, or empty for every property of the host. */
  propertyId: string;
  /** The id of the item the address points to (`?focus=`): it is brought into view and its drawer opens once. */
  focusId: string;
}

/**
 * The Timeline of every property (SR-02): reads `GET /api/calendar` for the days shown, draws the legend and the rows, and opens
 * the drawer of whatever is pressed. A failed read is an error with "Riprova", never an empty calendar; moving the window keeps the
 * last one on screen until the next arrives.
 */
export function TimelineSection({ start, zoom, propertyId, focusId }: TimelineSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const drawer = useDetailDrawer();
  const gridRef = useRef<HTMLDivElement>(null);
  const openedFocus = useRef('');

  const { data, isError, error, refetch, isPlaceholderData } = useHostCalendar(timelineQuery(start, zoom, propertyId));
  const today = data?.today ?? todayInRome();
  const days = useMemo(() => timelineDays(start, zoom), [start, zoom]);
  const rows = useMemo(() => (data ? buildTimelineRows(data, start, zoom, today) : []), [data, start, zoom, today]);

  const handleOpen = useCallback(
    (item: HostCalendarItem, opener: HTMLElement) => {
      // A page without a drawer (outside the shell) still takes a booking to its own page.
      if (!drawer.open(drawerKindOf(item), item.id, { opener }) && item.type === 'Booking') navigate(`${BOOKINGS_PATH}/${item.id}`);
    },
    [drawer, navigate],
  );

  // `?focus=`: the item is brought into view and its drawer opens, once for this address (closing the drawer does not open it again).
  const focusItem = useMemo(() => (focusId ? data?.items.find((item) => item.id === focusId) : undefined), [data, focusId]);
  useEffect(() => {
    if (!focusItem || isPlaceholderData) return;
    const element = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? []).find((candidate) => candidate.dataset.itemId === focusItem.id);
    element?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    if (openedFocus.current === focusItem.id) return;
    openedFocus.current = focusItem.id;
    drawer.open(drawerKindOf(focusItem), focusItem.id, { opener: element });
  }, [focusItem, isPlaceholderData, drawer]);

  // An API error is never shown as an empty calendar. (A refresh that fails while the days are on screen leaves them there.)
  if (isError && !data) {
    return <ErrorState title={t('booking.calendar.loadError')} error={error} onRetry={() => void refetch()} />;
  }

  if (!data) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex min-h-[28rem] flex-1 items-center justify-center gap-2 rounded-xl border bg-card text-sm text-foreground/70"
      >
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {t('booking.calendar.loading')}
      </div>
    );
  }

  if (data.properties.length === 0) {
    return (
      <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-xl border bg-card">
        <EmptyState
          icon={CalendarOff}
          title={t('booking.calendar.noProperties')}
          description={t('booking.calendar.noPropertiesHint')}
          action={{ label: t('booking.calendar.goToProperties'), href: '/app/short-rent/properties' }}
        />
      </div>
    );
  }

  // Where the host connects Airbnb or Booking.com: the calendars of the property when there is only one, else the properties.
  const connectHref = data.properties.length === 1 ? propertyTabPath(data.properties[0].id, 'ical') : PROPERTIES_PATH;

  return (
    <div className="flex flex-col gap-3" data-testid="calendar-timeline">
      <CalendarLegend kinds={TIMELINE_KINDS} />
      {data.propertiesTotal > data.properties.length ? (
        <p className="text-sm text-foreground/70" data-testid="timeline-cut">
          {t('booking.calendar.timeline.shown', { shown: data.properties.length, total: data.propertiesTotal })}
        </p>
      ) : null}
      <div ref={gridRef}>
        <HostTimeline rows={rows} days={days} today={today} focusId={focusId} busy={isPlaceholderData} onOpen={handleOpen} />
      </div>
      {data.items.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm" data-testid="timeline-empty">
          <p className="min-w-0 text-foreground/80">{t('booking.calendar.timeline.nothing')}</p>
          <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal py-2">
            <Link to={connectHref}>{t('booking.calendar.timeline.connect')}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
