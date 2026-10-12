import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { NavChildLinks } from '@/components/layout/nav-child-links';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { getProblemMessage } from '@/lib/api-errors';
import {
  useSupplierAgendaCalendar,
  useSupplierAvailability,
  useUpdateSupplierAvailability,
} from '@/queries/use-supplier';
import { addDays, formatStayDate, todayInRome } from '@/lib/stay-dates';
import { buildWorkingDays, minutesToHm } from './lib/supplier-agenda';
import type { DayEvent } from './lib/supplier-agenda';

const VISIBLE_DAYS = 14;

/** The next days (`YYYY-MM-DD`) from today in Europe/Rome, as the backend counts them. */
function buildVisibleDays(): string[] {
  const today = todayInRome();
  return Array.from({ length: VISIBLE_DAYS }, (_, index) => addDays(today, index));
}

function eventKindLabel(kind: DayEvent['kind'], t: (key: string) => string): string {
  switch (kind) {
    case 'calendar':
      return t('supplier.eventFromCalendar');
    case 'block':
      return t('supplier.eventBlock');
    case 'extra':
      return t('supplier.eventExtraOpening');
    case 'request':
      return t('supplier.eventRequest');
    case 'timeOff':
      return t('supplier.eventTimeOff');
    default:
      return kind;
  }
}

export function SupplierAvailabilityPage() {
  const { t } = useTranslation();
  const days = useMemo(() => buildVisibleDays(), []);
  const from = days[0];
  const to = days[days.length - 1];
  const availabilityQuery = useSupplierAvailability(from, to);
  const agendaQuery = useSupplierAgendaCalendar(from, to);
  const updateAvailability = useUpdateSupplierAvailability();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize local overrides from the closed days / availability once both sources have loaded.
  if (!initialized && availabilityQuery.data?.dates && agendaQuery.data) {
    setInitialized(true);
    const fromApi = Object.fromEntries(availabilityQuery.data.dates.map((entry) => [entry.date, entry.available]));
    const closed = new Set(agendaQuery.data.closedDays.map((day) => day.date));
    setSelected(
      Object.fromEntries(
        days.map((date) => [date, closed.has(date) ? false : (fromApi[date] ?? true)]),
      ),
    );
  }

  const workingDays = useMemo(() => {
    if (!agendaQuery.data) return [];
    return buildWorkingDays({
      dates: days,
      workingHours: agendaQuery.data.workingHours,
      closedDays: agendaQuery.data.closedDays,
      timeOff: agendaQuery.data.timeOff,
      blocks: agendaQuery.data.blocks,
      requests: agendaQuery.data.requests,
      availability: selected,
    }).map((day) => ({
      ...day,
      available: selected[day.date] ?? day.available,
    }));
  }, [agendaQuery.data, days, selected]);

  const hoursConfigured = (agendaQuery.data?.workingHours ?? []).some((day) => day.bands.length > 0);

  const toggleDay = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const save = async () => {
    const dates = days.map((date) => ({ date, available: selected[date] ?? true }));

    try {
      await updateAvailability.mutateAsync(dates);
      toast.success(t('supplier.availabilityUpdated'));
    } catch (saveError) {
      toast.error(getProblemMessage(saveError, t) ?? t('supplier.availabilitySaveError'));
    }
  };

  if (availabilityQuery.isError || agendaQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('supplier.availabilityTitle')}
          description={t('supplier.availabilityDescription')}
          action={<NavChildLinks parentPath="/app/supplier/availability" />}
        />
        <ErrorState
          testId="supplier-availability-error"
          title={t('supplier.availabilityLoadError')}
          error={availabilityQuery.error ?? agendaQuery.error}
          onRetry={() => {
            void availabilityQuery.refetch();
            void agendaQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (availabilityQuery.isLoading || agendaQuery.isLoading || !agendaQuery.data) {
    return <LoadingScreen message={t('supplier.availabilityLoading')} className="h-auto flex-1" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('supplier.availabilityTitle')}
        description={t('supplier.availabilityDescription')}
        action={<NavChildLinks parentPath="/app/supplier/availability" />}
      />

      {!hoursConfigured && (
        <Card className="border-amber-300 bg-amber-50" data-testid="supplier-hours-empty">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-amber-950">{t('supplier.hoursNotSetTitle')}</p>
              <p className="text-sm text-amber-900">{t('supplier.hoursNotSetHint')}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-400">
              <Link to="/app/supplier/profile">{t('supplier.hoursSetCta')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workingDays.map((day) => {
          const available = day.available;
          return (
            <Card key={day.date} data-testid={`availability-${day.date}`}>
              <CardContent className="space-y-3 p-3">
                <button type="button" className="w-full text-left" onClick={() => toggleDay(day.date)}>
                  <p className="text-sm font-medium">
                    {formatStayDate(day.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {available ? t('supplier.available') : t('supplier.notAvailable')}
                    {day.closed?.source === 'ICalFeed' ? ` · ${t('supplier.closedByCalendar')}` : null}
                  </p>
                </button>

                <div className="text-xs" data-testid={`availability-hours-${day.date}`}>
                  {day.bands.length > 0 ? (
                    <p className="text-muted-foreground">
                      {t('supplier.workingHoursLabel')}:{' '}
                      {day.bands.map((band) => `${minutesToHm(band.startMinute)}–${minutesToHm(band.endMinute)}`).join(', ')}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">{t('supplier.noWorkingHoursToday')}</p>
                  )}
                </div>

                {day.events.length > 0 ? (
                  <ul className="space-y-1" data-testid={`availability-events-${day.date}`}>
                    {day.events.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-md bg-muted/60 px-2 py-1 text-xs"
                        data-testid={`availability-event-${event.kind}`}
                      >
                        <span className="font-medium">{event.label}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {event.timeRange ?? t('supplier.allDay')} · {eventKindLabel(event.kind, t)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Button onClick={() => void save()} disabled={updateAvailability.isPending}>
        {t('supplier.saveAvailability')}
      </Button>
    </div>
  );
}
