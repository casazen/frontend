import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { NavChildLinks } from '@/components/layout/nav-child-links';
import { FocusBlock } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { getProblemMessage } from '@/lib/api-errors';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import {
  useCalendarSyncStatus,
  usePendingFreeEvents,
  useSupplierAgendaCalendar,
  useSupplierHours,
  useUpdateSupplierAvailability,
} from '@/queries/use-supplier';
import { AgendaDayView } from './components/agenda-day-view';
import { AgendaMonthView } from './components/agenda-month-view';
import { AgendaToolbar } from './components/agenda-toolbar';
import { AgendaWeekView } from './components/agenda-week-view';
import { FreeEventsBanner } from './components/free-events-banner';
import { WeeklyHoursSection } from './components/weekly-hours-section';
import { agendaParams, agendaRange, eachDay, readAgendaView, type AgendaView } from './lib/agenda-range';
import { pendingFreeEventDates } from './lib/free-events';
import { buildWorkingDays } from './lib/supplier-agenda';

/**
 * Agenda e disponibilità (SP-07a): the jobs and the commitments of the supplier as a day, a week or a month, the days it closed,
 * and the hours it works in a normal week. The view and the day are in the address (`?vista=giorno|settimana|mese`, `?data=`):
 * a phone starts from the day, a computer from the week. The calendar events marked "Disponibile" that wait for an answer are
 * the one block that asks for something. A day is closed or reopened from its page (a day of the week or of the month opens it).
 */
export function SupplierAvailabilityPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const phone = useMediaQuery(PHONE_QUERY);
  const today = todayInRome();

  const view = readAgendaView(params.get('vista')) ?? (phone ? 'day' : 'week');
  const requestedDate = params.get('data') ?? '';
  const date = isStayDate(requestedDate) ? requestedDate : today;
  const { from, to } = agendaRange(view, date);
  // The hours are changed in this page (SP-07b): the block that asks for them and the section of the hours open the same editor.
  const [editingHours, setEditingHours] = useState(false);

  const agendaQuery = useSupplierAgendaCalendar(from, to);
  const hoursQuery = useSupplierHours();
  const freeEventsQuery = usePendingFreeEvents();
  const syncQuery = useCalendarSyncStatus();
  const updateAvailability = useUpdateSupplierAvailability();

  const agenda = agendaQuery.data;
  const freeEvents = freeEventsQuery.data?.items;
  const pendingDates = useMemo(() => pendingFreeEventDates(freeEvents ?? []), [freeEvents]);
  const days = useMemo(
    () =>
      agenda
        ? buildWorkingDays({
            dates: eachDay(from, to),
            workingHours: agenda.workingHours,
            closedDays: agenda.closedDays,
            timeOff: agenda.timeOff,
            blocks: agenda.blocks,
            requests: agenda.requests,
          })
        : [],
    [agenda, from, to],
  );
  const hoursMissing = hoursQuery.data !== undefined && !hoursQuery.data.days.some((day) => day.bands.length > 0);
  const entries = days.reduce((total, day) => total + day.events.length, 0);

  const show = (next: { view?: AgendaView; date?: string }) =>
    setParams(agendaParams(next.view ?? view, next.date ?? date, today), { replace: true });

  const setDayOpen = async (day: string, available: boolean) => {
    try {
      await updateAvailability.mutateAsync([{ date: day, available }]);
      toast.success(t('supplier.availabilityUpdated'));
    } catch (saveError) {
      toast.error(getProblemMessage(saveError, t) ?? t('supplier.availabilitySaveError'));
    }
  };

  // The one thing the page asks for: the answers on the calendar events marked "Disponibile"; if there are none, the hours.
  const notice = freeEventsQuery.isError ? (
    <Alert
      variant="warning"
      data-testid="free-events-error"
      action={
        <Button size="sm" variant="outline" onClick={() => void freeEventsQuery.refetch()}>
          {t('supplier.retry')}
        </Button>
      }
    >
      {t('supplier.freeEventsLoadError')}
    </Alert>
  ) : freeEventsQuery.isLoading ? (
    <p className="text-sm text-foreground/70" role="status" data-testid="free-events-loading">
      {t('supplier.freeEventsLoading')}
    </p>
  ) : freeEventsQuery.data && freeEventsQuery.data.pendingCount > 0 ? (
    <FreeEventsBanner
      items={freeEventsQuery.data.items}
      pendingCount={freeEventsQuery.data.pendingCount}
      syncing={syncQuery.data?.lastSyncStatus === 'Syncing'}
    />
  ) : hoursMissing ? (
    <FocusBlock
      data-testid="supplier-hours-empty"
      title={t('supplier.hoursNotSetTitle')}
      body={t('supplier.hoursNotSetHint')}
      primary={{ label: t('supplier.hoursSetCta'), onClick: () => setEditingHours(true) }}
    />
  ) : null;

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-availability-page">
      <PageHeader
        title={t('supplier.agenda.title')}
        description={t('supplier.agenda.description')}
        crumbs="auto"
        action={<NavChildLinks parentPath="/app/supplier/availability" />}
      />

      {notice}

      <div className="space-y-4" data-testid="supplier-agenda">
        <AgendaToolbar
          view={view}
          date={date}
          today={today}
          onViewChange={(next) => show({ view: next })}
          onDateChange={(next) => show({ date: next })}
        />

        {agendaQuery.isError ? (
          <ErrorState
            testId="supplier-availability-error"
            title={t('supplier.availabilityLoadError')}
            error={agendaQuery.error}
            onRetry={() => void agendaQuery.refetch()}
          />
        ) : !agenda ? (
          <SkeletonList items={3} label={t('supplier.availabilityLoading')} />
        ) : (
          <>
            {entries === 0 && view !== 'day' ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="agenda-empty">
                <p className="min-w-0 break-words text-sm text-foreground/70">{t('supplier.agenda.emptyRange')}</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/supplier/inbox">{t('supplier.agenda.emptyRangeCta')}</Link>
                </Button>
              </div>
            ) : null}
            {view === 'day' ? (
              days[0] ? (
                <AgendaDayView
                  day={days[0]}
                  today={today}
                  pending={pendingDates.has(days[0].date)}
                  busy={updateAvailability.isPending}
                  onToggle={(open) => void setDayOpen(days[0].date, open)}
                />
              ) : null
            ) : view === 'week' ? (
              <AgendaWeekView days={days} today={today} pendingDates={pendingDates} />
            ) : (
              <AgendaMonthView days={days} today={today} pendingDates={pendingDates} />
            )}
          </>
        )}
      </div>

      <WeeklyHoursSection editing={editingHours} onEditingChange={setEditingHours} />
    </div>
  );
}
