import { useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BlockDetails } from './components/block-details';
import { BookingCalendar } from './components/booking-calendar';
import { CalendarToolbar } from './components/calendar-toolbar';
import { ManualBlockForm } from './components/manual-block-form';
import { TimelineSection } from './components/timeline-section';
import { useBookingCalendar } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { CalendarDays, CalendarOff, List, Loader2, Plus } from 'lucide-react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { FROM_TABLET_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import type { SlotInfo } from 'react-big-calendar';
import { addDays, toStayDate, todayInRome } from '@/lib/stay-dates';
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
  type CalendarPageView,
  type TimelineZoom,
} from './lib/host-timeline';

const BOOKINGS_PATH = '/app/short-rent/bookings';

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
  // "Blocca date" and "Elimina blocco" need property.write (PC-09).
  const canWriteProperty = workspace?.hasPermission('short-rent', 'property.write') ?? false;
  // The "Blocca date" form, open with the nights selected on the calendar (or from today).
  const [blockDraft, setBlockDraft] = useState<{ start?: string; end?: string } | null>(null);
  // The property the form closes dates of, when the calendar shows all of them and does not say which.
  const [blockPropertyId, setBlockPropertyId] = useState('');

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
  const formPropertyId = activePropertyId || blockPropertyId || propertyList[0]?.id || '';

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
        setBlockDraft(null);
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

  // Days selected on the calendar: the nights from the first to the last selected day are closed.
  const handleSelectSlot = useCallback((slot: SlotInfo) => {
    const days = (slot.slots.length > 0 ? slot.slots : [slot.start]).map(toStayDate).filter(Boolean).sort();
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return;
    setSelectedBlockId(null);
    setBlockDraft({ start: first, end: addDays(last, 1) });
  }, []);

  return (
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
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedBlockId(null);
                  setBlockDraft({});
                }}
                data-testid="manual-block-open"
              >
                <CalendarOff className="mr-2 h-4 w-4" />
                {t('booking.calendar.manualBlock.action')}
              </Button>
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
            <CalendarToolbar
              properties={propertyList}
              propertyId={activePropertyId}
              onPropertyChange={(propertyId) => {
                setSelectedBlockId(null);
                setBlockDraft(null);
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

            {blockDraft && formPropertyId && (
              <section aria-labelledby="manual-block-form-title" className="space-y-3 rounded-xl border bg-card p-4">
                <h2 id="manual-block-form-title" className="font-semibold">
                  {t('booking.calendar.manualBlock.formTitle')}
                </h2>
                {/* The Timeline may show every property: then the form asks which one the dates are closed for. */}
                {!activePropertyId && propertyList.length > 1 && (
                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="manual-block-property">{t('booking.calendar.property')}</Label>
                    <Select id="manual-block-property" value={formPropertyId} onChange={(event) => setBlockPropertyId(event.target.value)}>
                      {propertyList.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <ManualBlockForm
                  key={`${formPropertyId}-${blockDraft.start ?? ''}-${blockDraft.end ?? ''}`}
                  propertyId={formPropertyId}
                  initialStart={blockDraft.start}
                  initialEnd={blockDraft.end}
                  onCreated={() => setBlockDraft(null)}
                  onCancel={() => setBlockDraft(null)}
                />
              </section>
            )}

            {view === 'timeline' ? (
              <TimelineSection start={anchor} zoom={zoom} propertyId={activePropertyId} focusId={focusId} />
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
                <BookingCalendar
                  events={calendarLoading ? [] : events}
                  date={anchor}
                  view={view}
                  onNavigate={handleDateChange}
                  onView={handleMonthView}
                  onSelectEvent={handleSelectEvent}
                  onSelectSlot={canWriteProperty ? handleSelectSlot : undefined}
                  loading={calendarLoading}
                />
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
