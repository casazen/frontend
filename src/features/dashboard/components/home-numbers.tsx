import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { addDays, formatStayDate } from '@/lib/stay-dates';
import type { DashboardArrival, DashboardOverview } from '@/types/dashboard.types';
import type { HomePeriod } from '../lib/home-period';

interface HomeNumbersProps {
  overview: DashboardOverview;
  period: HomePeriod;
}

/** "Prossimi arrivi": the next three, with when they come. Not a `StatTile`: a number says nothing here, names do. */
function NextArrivals({ arrivals, today }: { arrivals: DashboardArrival[]; today: string }) {
  const { t, i18n } = useTranslation();
  const when = (date: string) =>
    date === today
      ? t('dashboard.numbers.when.today')
      : date === addDays(today, 1)
        ? t('dashboard.numbers.when.tomorrow')
        : formatStayDate(date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="min-w-0 py-3" data-testid="home-next-arrivals">
      <p className="text-sm text-foreground/70">{t('dashboard.numbers.nextArrivals')}</p>
      {arrivals.length > 0 ? (
        <ul role="list" className="mt-1">
          {arrivals.map((arrival) => (
            <li key={arrival.bookingId} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 text-sm">
              <Link to={`/app/short-rent/bookings/${arrival.bookingId}`} className="min-w-0 break-words font-semibold hover:underline">
                {arrival.guestName}
              </Link>
              <span className="text-foreground/70">{when(arrival.checkInDate.slice(0, 10))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-foreground/70">{t('dashboard.numbers.noArrivals')}</p>
      )}
    </div>
  );
}

/**
 * The numbers of the Home, each against the period before: occupancy, revenue (only for who may read payments: the server leaves
 * it out for the others), the bookings to come with how many wait for an answer, and who arrives next. On a phone they scroll
 * sideways, one at a time.
 */
export function HomeNumbers({ overview, period }: HomeNumbersProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { occupancy, revenue, upcoming } = overview;
  const signed = (value: number) => new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(value);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: revenue?.currency ?? 'EUR', maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const arrivalsChange = upcoming.count - upcoming.previousCount;

  return (
    <StatStrip
      label={t('dashboard.numbers.label')}
      data-testid="home-numbers"
      className="max-sm:[&>ul]:flex max-sm:[&>ul]:snap-x max-sm:[&>ul]:snap-mandatory max-sm:[&>ul]:overflow-x-auto max-sm:[&>ul>li]:w-[78%] max-sm:[&>ul>li]:shrink-0 max-sm:[&>ul>li]:snap-start"
    >
      <StatTile
        label={t('dashboard.numbers.occupancy')}
        value={occupancy.rate === null ? '—' : percent.format(occupancy.rate)}
        delta={
          occupancy.deltaPoints == null
            ? undefined
            : t('dashboard.numbers.delta.points', { count: Math.abs(occupancy.deltaPoints), value: signed(occupancy.deltaPoints) })
        }
      />
      {revenue ? (
        <StatTile
          label={t(`dashboard.numbers.revenue.${period}`)}
          value={money.format(revenue.amount)}
          delta={revenue.deltaPercent == null ? undefined : t('dashboard.numbers.delta.percent', { value: `${signed(revenue.deltaPercent)}%` })}
        />
      ) : null}
      <StatTile
        label={t('dashboard.numbers.upcoming')}
        value={upcoming.count}
        href="/app/short-rent/bookings"
        delta={[
          upcoming.pendingApproval > 0 ? t('dashboard.numbers.pending', { count: upcoming.pendingApproval }) : null,
          t('dashboard.numbers.delta.count', { value: signed(arrivalsChange) }),
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <NextArrivals arrivals={overview.nextArrivals} today={overview.today} />
    </StatStrip>
  );
}
