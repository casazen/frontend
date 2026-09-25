import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BookingCalendar } from './components/booking-calendar';
import { useBookingCalendar } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { List, X } from 'lucide-react';
import { getProblemMessage } from '@/lib/api-errors';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import {
  blockSourceLabel,
  hostCalendarRange,
  toHostCalendarEvents,
  type HostCalendarBlockEvent,
  type HostCalendarEvent,
  type HostCalendarView,
} from './lib/host-calendar';

/**
 * Dates taken on another channel, opened from the calendar: where they come from and the stay dates. A block is not a
 * CasaZen booking, so there is no booking detail to open.
 */
function BlockDetails({ block, onClose }: { block: HostCalendarBlockEvent; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <section
      aria-labelledby="calendar-block-title"
      className="space-y-2 rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="calendar-block-title" className="font-medium">
          {t('booking.calendar.block.title', { source: blockSourceLabel(block, t) })}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('booking.calendar.block.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p>
        {t('booking.calendar.dates', {
          arrival: formatStayDate(block.arrival, i18n.language),
          departure: formatStayDate(block.departure, i18n.language),
          count: block.nights,
        })}
      </p>
      {block.summary && <p className="text-muted-foreground">{t('booking.calendar.block.summary', { summary: block.summary })}</p>}
      <p className="text-muted-foreground">{t('booking.calendar.block.notABooking')}</p>
      {/* TODO(CO-21): "Crea soggiorno OTA" from this block (guest check-in, Alloggiati) once CO-21 publishes it. */}
    </section>
  );
}

export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const propertyList = Array.isArray(properties) ? properties : [];
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [view, setView] = useState<HostCalendarView>('month');
  // The day around which the view is shown; "today" is the calendar date in Rome (QA-CLOCK-FE).
  const [shownDate, setShownDate] = useState<string>(() => todayInRome());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const activePropertyId = selectedPropertyId || propertyList[0]?.id || '';
  // First and last stay date of the month, week or day shown, both included (backend MO-06): part of the query key,
  // so every navigation asks for its own range.
  const { startDate, endDate } = useMemo(() => hostCalendarRange(view, shownDate), [view, shownDate]);

  const {
    data: calendarResponse,
    isLoading: calendarLoading,
    isError,
    error,
    refetch,
  } = useBookingCalendar(activePropertyId ? { propertyId: activePropertyId, startDate, endDate } : undefined);

  const events = useMemo(() => toHostCalendarEvents(calendarResponse?.items ?? []), [calendarResponse]);
  const selectedBlock = events.find(
    (event): event is HostCalendarBlockEvent => event.kind === 'block' && event.id === selectedBlockId,
  );

  const handleSelectEvent = useCallback(
    (event: HostCalendarEvent) => {
      if (event.kind === 'booking') {
        navigate(`/app/short-rent/bookings/${event.id}`);
      } else {
        setSelectedBlockId(event.id);
      }
    },
    [navigate],
  );

  const handleNavigate = useCallback((date: string) => {
    if (date) setShownDate(date);
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('booking.calendar.pageTitle')}
          description={t('booking.calendar.pageDescription')}
          action={
            <Button variant="outline" onClick={() => navigate('/app/short-rent/bookings')}>
              <List className="mr-2 h-4 w-4" />
              {t('booking.calendar.listView')}
            </Button>
          }
        />

        {propertiesLoading ? (
          <div className="flex h-[600px] items-center justify-center" role="status">
            <p>{t('booking.calendar.loading')}</p>
          </div>
        ) : propertyList.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-center">
            <p className="font-medium">{t('booking.calendar.noProperties')}</p>
            <p className="text-sm text-muted-foreground">
              {t('booking.calendar.noPropertiesHint')}
            </p>
            <Button onClick={() => navigate('/app/short-rent/properties')}>{t('booking.calendar.goToProperties')}</Button>
          </div>
        ) : (
          <>
            <div className="max-w-sm space-y-2">
              <Label htmlFor="calendar-property">{t('booking.calendar.property')}</Label>
              <select
                id="calendar-property"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={activePropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  setSelectedBlockId(null);
                }}
              >
                {propertyList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {isError ? (
              // An API error is never shown as an empty calendar.
              <div
                role="alert"
                className="flex h-[400px] flex-col items-center justify-center gap-3 rounded-lg border text-center"
              >
                <p className="font-medium text-destructive">{t('booking.calendar.loadError')}</p>
                {getProblemMessage(error, t) && (
                  <p className="max-w-md text-sm text-muted-foreground">{getProblemMessage(error, t)}</p>
                )}
                <Button variant="outline" onClick={() => void refetch()}>
                  {t('booking.calendar.retry')}
                </Button>
              </div>
            ) : (
              <>
                <BookingCalendar
                  events={calendarLoading ? [] : events}
                  date={shownDate}
                  view={view}
                  onNavigate={handleNavigate}
                  onView={setView}
                  onSelectEvent={handleSelectEvent}
                  loading={calendarLoading}
                />
                {selectedBlock && <BlockDetails block={selectedBlock} onClose={() => setSelectedBlockId(null)} />}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
