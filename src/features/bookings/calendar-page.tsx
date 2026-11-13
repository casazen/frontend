import { useCallback, useContext, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { BlockDetails } from './components/block-details';
import { BookingCalendar } from './components/booking-calendar';
import { CalendarChangeStatus } from './components/calendar-change-status';
import { CalendarToolbar } from './components/calendar-toolbar';
import { DayLayerNotice } from './components/day-layer-notice';
import { DayPanel } from './components/day-panel';
import { TimelineSection } from './components/timeline-section';
import { useBookingCalendar } from '@/queries/use-bookings';
import { useUnreadMessagesByBooking } from '@/queries/use-booking-messages';
import { UnreadMessagesContext } from './lib/unread-messages-context';
import { useProperties } from '@/queries/use-properties';
import { CalendarDays, CalendarOff, CalendarRange, List, Loader2, Plus } from 'lucide-react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { FROM_TABLET_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import type { SlotInfo } from 'react-big-calendar';
import { toStayDate, todayInRome } from '@/lib/stay-dates';
import { clearSelection, pressDay, selectionOfDays, startSelection, type DaySelection } from './lib/day-selection';
import {
  hostCalendarRange,
  toHostCalendarEvents,
  type HostCalendarBlockEvent,
  type HostCalendarEvent,
  type HostCalendarView,
} from './lib/host-calendar';
import {
  parseCalendarView,
  parseTimelineZoom,
  resolveCalendarAnchor,
  timelineQuery,
  type CalendarPageView,
  type TimelineZoom,
} from './lib/host-timeline';
import { useDayLayer } from './lib/use-day-layer';

const BOOKINGS_PATH = '/app/short-rent/bookings';
const BULK_PATH = '/app/short-rent/bookings/calendar/bulk';
const NO_UNREAD: ReadonlyMap<string, number> = new Map();

/**
 * The calendar of the host (SR-02): the Timeline of every property, or the month, the week and the day of one. What is shown is
 * in the address, so that a link (from the Home, from a property) lands on the right place and Back goes where it should:
 * `?view=timeline|month|week|day`, `?zoom=7|14|30` (Timeline), `?from=` (first day of the Timeline, or the day the month, week or
 * day is around), `?propertyId=` and `?focus=` (an item to bring into view). Without a view a screen with room opens the Timeline
 * and a phone the month.
 */
export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const detailDrawer = useDetailDrawer();
  const wideScreen = useMediaQuery(FROM_TABLET_QUERY);
  const { data: properties, isLoading: propertiesLoading } = useProperties({ mode: 'short' });
  const propertyList = Array.isArray(properties) ? properties : [];
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // "Crea soggiorno OTA" needs booking.write (CO-21); without a workspace (e.g. tests) nothing is offered.
  const workspace = useContext(WorkspaceContext);
  const canWriteBookings = workspace?.hasPermission('short-rent', 'booking.write') ?? false;
  // Selecting days to block them or change their price and rules, and "Elimina blocco", need property.write (PC-09, NF-78).
  const canWriteProperty = workspace?.hasPermission('short-rent', 'property.write') ?? false;
  // The price and the rules of every day are property data: read only by who may read properties (without the right nothing is asked, and the calendar is what it was).
  const canReadProperty = workspace?.hasPermission('short-rent', 'property.read') ?? false;
  // The changes sent to the channel manager are followed only while its connector is on (`octorateConnector`): with it off nothing is sent there, asked or said about it.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  // The guests' messages not read yet, once for the whole calendar: the entries of a stay with some carry a counter (SR-12).
  const unreadMessages = useUnreadMessagesByBooking(workspace?.hasPermission('short-rent', 'booking.read') ?? false);
  // The days selected on the calendar (the Timeline, the month, the week or the day): they open the panel that blocks them or changes their price and rules.
  const [selection, setSelection] = useState<DaySelection | null>(null);
  // The panel takes the focus when it is opened from the button; from a day of the calendar the focus stays there (Shift plus arrow goes on extending the selection).
  const [focusPanel, setFocusPanel] = useState(false);

  const view = parseCalendarView(searchParams.get('view'), wideScreen);
  const zoom = parseTimelineZoom(searchParams.get('zoom'));
  // The day around which the view is shown; "today" is the calendar date in Rome (QA-CLOCK-FE).
  const anchor = resolveCalendarAnchor(searchParams.get('from'), view, todayInRome());
  const focusId = searchParams.get('focus') ?? '';
  // The calendar of one property, from the list of the properties (`?propertyId=`): one that is not in the list is ignored.
  const requestedPropertyId = searchParams.get('propertyId') ?? '';
  const requestedProperty = propertyList.some((property) => property.id === requestedPropertyId) ? requestedPropertyId : '';
  // The Timeline shows every property unless one is asked for; the month, the week and the day always show one (the first by default).
  const activePropertyId = requestedProperty || (view === 'timeline' ? '' : (propertyList[0]?.id ?? ''));
  // The property "Blocca date" starts from: the one shown, else the first (the Timeline of every property does not say which; the next click on a day does).
  const startPropertyId = activePropertyId || propertyList[0]?.id || '';
  const activeProperty = propertyList.find((property) => property.id === activePropertyId);

  const setQuery = useCallback(
    (changes: Record<string, string | null>) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // First and last stay date of the month, week or day shown, both included (backend MO-06): part of the query key,
  // so every navigation asks for its own range. The Timeline reads its own range (`TimelineSection`).
  const monthRange = useMemo(() => (view === 'timeline' ? null : hostCalendarRange(view, anchor)), [view, anchor]);
  const {
    data: calendarResponse,
    isLoading: calendarLoading,
    isError,
    error,
    refetch,
  } = useBookingCalendar(
    monthRange && activePropertyId ? { propertyId: activePropertyId, startDate: monthRange.startDate, endDate: monthRange.endDate } : undefined,
  );

  // The price and the rules of the days the view shows (E08/F05/US03/T01): the window of the Timeline (it shares the entry of the cache of its own read) or the range of the
  // month, the week or the day of the property shown.
  const daysQuery = useMemo(
    () =>
      view === 'timeline'
        ? timelineQuery(anchor, zoom, activePropertyId)
        : monthRange && activePropertyId
          ? { from: monthRange.startDate, to: monthRange.endDate, propertyId: activePropertyId }
          : undefined,
    [view, anchor, zoom, activePropertyId, monthRange],
  );
  const dayRead = useDayLayer(daysQuery, canReadProperty);

  const events = useMemo(() => toHostCalendarEvents(calendarResponse?.items ?? []), [calendarResponse]);
  const selectedBlock = events.find(
    (event): event is HostCalendarBlockEvent => event.kind === 'block' && event.id === selectedBlockId,
  );

  const handleSelectEvent = useCallback(
    (event: HostCalendarEvent) => {
      if (event.kind === 'booking') {
        // The drawer of the booking (UI-15), as in the Home and the list; a page without a drawer goes to the page of the booking.
        if (!detailDrawer.open('booking', event.id)) navigate(`${BOOKINGS_PATH}/${event.id}`);
      } else {
        setSelection(clearSelection());
        setSelectedBlockId(event.id);
      }
    },
    [detailDrawer, navigate],
  );

  // The day to show moves in the address; the default day is not written there (the address stays short, "today" moves with the clock).
  const handleDateChange = useCallback(
    (date: string) => {
      if (!date) return;
      setQuery({ from: date === resolveCalendarAnchor(null, view, todayInRome()) ? null : date });
    },
    [setQuery, view],
  );

  const handleMonthView = useCallback((next: HostCalendarView) => setQuery({ view: next }), [setQuery]);

  // Days selected on the month, the week or the day (a click or a drag of the library): the same selection as the Timeline's, and it opens the same panel.
  const handleSelectSlot = useCallback(
    (slot: SlotInfo) => {
      const next = selectionOfDays(activePropertyId, (slot.slots.length > 0 ? slot.slots : [slot.start]).map(toStayDate));
      if (!next) return;
      setSelectedBlockId(null);
      setFocusPanel(false);
      setSelection(next);
    },
    [activePropertyId],
  );

  // A press on a day (a click, Enter or Space; with Shift the selection grows): the first press starts a selection, the second extends it.
  const handlePressDay = useCallback((propertyId: string, day: string, shift: boolean, origin?: string) => {
    setSelectedBlockId(null);
    setFocusPanel(false);
    setSelection((previous) => pressDay(previous, propertyId, day, shift, origin));
  }, []);
  const handleClearSelection = useCallback(() => setSelection(clearSelection()), []);

  return (
    <UnreadMessagesContext.Provider value={unreadMessages.data ?? NO_UNREAD}>
    <AppShell>
      {/* A column that fills the content region: the calendar takes the height the screen has left (`host-calendar.css`). */}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PageHeader
          title={t('booking.calendar.pageTitle')}
          description={t('booking.calendar.pageDescription')}
          crumbs="auto"
          primary={
            canWriteBookings && propertyList.length > 0
              ? { label: t('booking.list.newBooking'), icon: Plus, to: `${BOOKINGS_PATH}/create`, testId: 'calendar-new-booking' }
              : undefined
          }
          secondary={[{ label: t('booking.calendar.listView'), icon: List, to: BOOKINGS_PATH }]}
          mobilePrimary="none"
          action={
            canWriteProperty && propertyList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // The panel opens on tonight of the property shown (or the first): the dates and the property are changed by selecting other days on the calendar.
                    setSelectedBlockId(null);
                    setFocusPanel(true);
                    setSelection(startSelection(startPropertyId, todayInRome()));
                  }}
                  data-testid="manual-block-open"
                >
                  <CalendarOff className="mr-2 h-4 w-4" />
                  {t('booking.calendar.manualBlock.action')}
                </Button>
                {/* A change of many days: a guided wizard of its own (E08/F05/US03/T03). */}
                <Button asChild variant="outline">
                  <Link to={BULK_PATH} data-testid="calendar-bulk-open">
                    <CalendarRange className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t('booking.calendar.bulk.open')}
                  </Link>
                </Button>
              </div>
            ) : undefined
          }
        />

        {propertiesLoading ? (
          <div
            role="status"
            aria-busy="true"
            className="flex min-h-[28rem] flex-1 items-center justify-center gap-2 rounded-xl border bg-card text-sm text-foreground/70"
          >
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t('booking.calendar.loading')}
          </div>
        ) : propertyList.length === 0 ? (
          <div className="flex min-h-[28rem] flex-1 items-center justify-center rounded-xl border bg-card">
            <EmptyState
              icon={CalendarDays}
              title={t('booking.calendar.noProperties')}
              description={t('booking.calendar.noPropertiesHint')}
              action={{ label: t('booking.calendar.goToProperties'), href: '/app/short-rent/properties' }}
            />
          </div>
        ) : (
          <>
            {/* The changes sent to the channel manager that are waiting or failed: a line that goes away when everything is delivered. Only who may read properties gets it, and only with the connector on. */}
            {canReadProperty && connectorOn ? (
              <CalendarChangeStatus propertyName={(id) => propertyList.find((property) => property.id === id)?.name ?? ''} canRetry={canWriteProperty} />
            ) : null}
            <CalendarToolbar
              properties={propertyList}
              propertyId={activePropertyId}
              onPropertyChange={(propertyId) => {
                setSelectedBlockId(null);
                setSelection(clearSelection());
                setQuery({ propertyId: propertyId || null });
              }}
              view={view}
              zoom={zoom}
              date={anchor}
              onViewChange={(next: CalendarPageView) => setQuery({ view: next })}
              onZoomChange={(next: TimelineZoom) => setQuery({ zoom: String(next) })}
              onDateChange={handleDateChange}
              showPeriod={view === 'timeline' || !isError}
            />

            {view === 'timeline' ? (
              <TimelineSection
                start={anchor}
                zoom={zoom}
                propertyId={activePropertyId}
                focusId={focusId}
                dayLayer={dayRead.layer}
                dayLayerFailed={dayRead.failed}
                onRetryDayLayer={dayRead.retry}
                selection={selection}
                onPressDay={canWriteProperty ? handlePressDay : undefined}
                onClearSelection={handleClearSelection}
              />
            ) : isError ? (
              // An API error is never shown as an empty calendar.
              <ErrorState title={t('booking.calendar.loadError')} error={error} onRetry={() => void refetch()} />
            ) : (
              <>
                {/* Above the grid, not under it: the grid fills the screen, and what a click opens must be seen where it was clicked. */}
                {selectedBlock && (
                  <BlockDetails
                    key={selectedBlock.id}
                    block={selectedBlock}
                    propertyId={activePropertyId}
                    onClose={() => setSelectedBlockId(null)}
                    canWrite={canWriteBookings}
                    canWriteProperty={canWriteProperty}
                    onBlockDeleted={() => setSelectedBlockId(null)}
                    onStayCreated={(booking) => {
                      setSelectedBlockId(null);
                      // The guest tab: the check-in link of the new stay is sent from there (CO-09).
                      navigate(`${BOOKINGS_PATH}/${booking.id}?tab=guest`);
                    }}
                  />
                )}
                {dayRead.failed ? <DayLayerNotice onRetry={dayRead.retry} /> : null}
                <BookingCalendar
                  events={calendarLoading ? [] : events}
                  date={anchor}
                  view={view}
                  onNavigate={handleDateChange}
                  onView={handleMonthView}
                  onSelectEvent={handleSelectEvent}
                  onSelectSlot={canWriteProperty ? handleSelectSlot : undefined}
                  loading={calendarLoading}
                  property={activeProperty}
                  dayLayer={activePropertyId ? dayRead.layer?.get(activePropertyId) : undefined}
                  selection={selection}
                  onPressDay={canWriteProperty ? handlePressDay : undefined}
                  onClearSelection={handleClearSelection}
                />
              </>
            )}
          </>
        )}
      </div>
      {/* The panel of the days selected: block them, change their price or their rules. Only who may write properties gets it. */}
      {selection && canWriteProperty ? (
        <DayPanel
          selection={selection}
          propertyName={propertyList.find((property) => property.id === selection.propertyId)?.name ?? ''}
          layer={dayRead.layer?.get(selection.propertyId)}
          today={todayInRome()}
          onClose={handleClearSelection}
          moveFocus={focusPanel}
        />
      ) : null}
    </AppShell>
    </UnreadMessagesContext.Provider>
  );
}
