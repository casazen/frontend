import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarDays, LogIn, LogOut, Sparkles, Sun, Wrench, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { CheckInDialog } from '@/features/bookings/components/check-in-dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { useBooking } from '@/queries/use-bookings';
import { useRefreshDashboard } from '@/queries/use-dashboard';
import type { HomeRow, TodayKind } from '../lib/home-model';
import { HomeRowItem } from './home-row';

const KIND_ICONS: Record<TodayKind, LucideIcon> = { arrivals: LogIn, departures: LogOut, cleaning: Sparkles, jobs: Wrench };
const KINDS: readonly TodayKind[] = ['arrivals', 'departures', 'cleaning', 'jobs'];

/** The dialog of "Registra arrivo" needs the whole booking: it is read when the button is pressed, and the dialog opens with it. */
function ArrivalDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const booking = useBooking(bookingId);
  const { isError, error } = booking;

  useEffect(() => {
    if (!isError) return;
    toast.error(getProblemMessage(error, t) ?? t('dashboard.today.arrivalLoadFailed'));
    onClose();
  }, [isError, error, onClose, t]);

  return <CheckInDialog booking={booking.data ?? null} open={!!booking.data} onOpenChange={(open) => !open && onClose()} />;
}

interface TodayCardProps {
  rows: HomeRow[];
  /** Today in Europe/Rome (`yyyy-MM-dd`). */
  day: string;
  /** Items of the day that the list does not carry (the server sends the first ones): said, not hidden. */
  more: number;
}

/**
 * "Oggi": the one highlighted block of the Home. Arrivals, departures and interventions of the day, each with the one
 * button that does what it asks; the chips filter by kind without leaving the page. A row that is done stays, ticked.
 */
export function TodayCard({ rows, day, more }: TodayCardProps) {
  const { t, i18n } = useTranslation();
  const refresh = useRefreshDashboard();
  const [kind, setKind] = useState<TodayKind | 'all'>('all');
  const [arrivalId, setArrivalId] = useState<string | null>(null);

  const counts = Object.fromEntries(KINDS.map((k) => [k, rows.filter((row) => row.kind === k).length])) as Record<TodayKind, number>;
  const current = kind === 'all' || counts[kind] > 0 ? kind : 'all';
  const shown = current === 'all' ? rows : rows.filter((row) => row.kind === current);
  const closeArrival = useCallback(() => {
    setArrivalId(null);
    refresh();
  }, [refresh]);

  return (
    <section aria-labelledby="home-today-title" data-testid="home-today" className="min-w-0 overflow-hidden rounded-xl bg-card ring-1 ring-inset ring-primary/25">
      <header className="space-y-3 bg-primary-soft px-4 py-4 sm:px-5">
        <h2 id="home-today-title" className="break-words text-xl font-bold tracking-tight">
          {t('dashboard.today.title')}
          <span className="font-medium text-foreground/70"> · {formatStayDate(day, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </h2>
        {rows.length > 0 ? (
          <Segmented<TodayKind | 'all'>
            label={t('dashboard.today.filterLabel')}
            value={current}
            onValueChange={setKind}
            options={[
              { value: 'all', label: `${t('dashboard.today.kinds.all')} ${rows.length}` },
              ...KINDS.filter((k) => counts[k] > 0).map((k) => ({ value: k, label: `${t(`dashboard.today.kinds.${k}`)} ${counts[k]}` })),
            ]}
          />
        ) : null}
      </header>

      {rows.length > 0 ? (
        <>
          <ul role="list" className="divide-y divide-border">
            {shown.map((row) => (
              <HomeRowItem key={row.id} row={row} icon={row.kind ? KIND_ICONS[row.kind] : undefined} className="px-4 sm:px-5" onRegisterArrival={setArrivalId} />
            ))}
          </ul>
          {more > 0 ? (
            <p className="border-t border-border px-4 py-3 text-sm text-foreground/70 sm:px-5">
              {t('dashboard.today.more', { count: more })}{' '}
              <Link to="/app/short-rent/bookings" className="font-medium text-primary-text underline-offset-4 hover:underline">
                {t('dashboard.today.moreLink')}
              </Link>
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-foreground/70">
            <Sun className="size-[22px]" />
          </span>
          <div className="min-w-0 flex-1 basis-52">
            <p className="font-semibold">{t('dashboard.today.free.title')}</p>
            <p className="text-sm text-foreground/70">{t('dashboard.today.free.text')}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-auto min-h-11 whitespace-normal py-2">
            <Link to="/app/short-rent/bookings/calendar">
              <CalendarDays aria-hidden="true" className="size-4" />
              {t('dashboard.today.free.cta')}
            </Link>
          </Button>
        </div>
      )}

      {arrivalId ? <ArrivalDialog key={arrivalId} bookingId={arrivalId} onClose={closeArrival} /> : null}
    </section>
  );
}
