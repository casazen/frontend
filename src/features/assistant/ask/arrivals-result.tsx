import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/api/dashboard.api';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import {
  arrivalsCapability,
  disambiguatingBookingReference,
  manualArrivalsPath,
  summarizeArrivals,
} from './arrivals-capability';

export function ArrivalsResult({
  scope,
  propertyId,
  onNavigate,
}: {
  scope: string;
  propertyId: string | null;
  onNavigate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const today = todayInRome();
  const read = useQuery({
    queryKey: ['ask', arrivalsCapability.id, scope, today],
    queryFn: async ({ signal }) => summarizeArrivals(await dashboardApi.getToday(signal), propertyId),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const data = read.data;
  const stale = data && data.day !== today;
  const emptyKey = data?.partial ? 'ask.nonePartial' : data?.scopedCount ? 'ask.none' : 'ask.noArrivals';
  const format = (day: string) =>
    formatStayDate(day, i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section aria-label={t('ask.question')} className="space-y-3">
      <div aria-live="polite" className="space-y-2 text-sm">
        {read.isFetching ? (
          <p role="status">{t('ask.loading')}</p>
        ) : read.isError || !data ? (
          <p>{t('ask.unavailable')}</p>
        ) : (
          <>
            <h3 className="font-semibold">{t('ask.source', { day: format(data.day) })}</h3>
            {data.propertyName && <p>{data.propertyName}</p>}
            {stale ? (
              <p>{t('ask.stale')}</p>
            ) : (
              <>
                {data.partial && (
                  <p>
                    {t('ask.partial')}{' '}
                    <Link
                      to="/app/short-rent/bookings"
                      onClick={onNavigate}
                      className="font-medium text-primary-text underline"
                    >
                      {t('nav.bookings')}
                    </Link>
                  </p>
                )}
                {data.rows.length === 0 ? (
                  <p>{t(emptyKey)}</p>
                ) : (
                  <ul className="divide-y rounded-lg border px-3">
                    {data.rows.map((stay) => {
                      const reference = disambiguatingBookingReference(stay, data.rows);
                      return (
                        <li key={stay.bookingId}>
                          <Link
                            to={`/app/short-rent/bookings/${encodeURIComponent(stay.bookingId)}?tab=guest`}
                            onClick={onNavigate}
                            className="flex min-h-11 items-center justify-between gap-2 rounded py-2 focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <span className="min-w-0">
                              <strong className="block break-words">{stay.propertyName}</strong>
                              <span className="block">
                                {format(stay.checkInDate)} – {format(stay.checkOutDate)}
                              </span>
                              <span className="text-foreground/75">{t(`ask.states.${stay.state}`)}</span>
                              {reference && (
                                <span className="block break-all">{t('ask.bookingReference', { reference })}</span>
                              )}
                              <span className="sr-only"> · {t('ask.openBooking')}</span>
                            </span>
                            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
      {(read.isError || stale) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={read.isFetching}
          onClick={() => void read.refetch()}
        >
          {t('ask.retry')}
        </Button>
      )}
      <Button asChild variant="link" className="h-auto min-h-11 whitespace-normal px-0 text-primary-text">
        <Link to={manualArrivalsPath(propertyId)} onClick={onNavigate}>
          {t('ask.manual')}
        </Link>
      </Button>
    </section>
  );
}
