import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { bookingNights } from '@/features/bookings/lib/booking-price';
import { todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { Booking } from '@/types';
import { sortStays, stayRangeText } from '../lib/guest-stays';

const ROW =
  'group/open flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md py-3 outline-hidden ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface GuestStaysTabProps {
  stays: readonly Booking[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/**
 * The tab Soggiorni: every booking of the guest, the latest first, each a link to its booking with where, when, how much and
 * how it stands. A list with lines between the rows, no table and no box.
 */
export function GuestStaysTab({ stays, isLoading, isError, error, onRetry }: GuestStaysTabProps) {
  const { t, i18n } = useTranslation();
  const today = todayInRome();
  const sorted = sortStays(stays);

  return (
    <PlainSection title={t('guests.detailPage.staysTitle')} count={sorted.length} data-testid="guest-stays">
      {isLoading ? (
        <div role="status" aria-busy="true" className="space-y-3" data-testid="guest-stays-loading">
          <span className="sr-only">{t('shared.loading.srOnly')}</span>
          <Skeleton aria-hidden="true" className="h-12 w-full motion-reduce:animate-none" />
          <Skeleton aria-hidden="true" className="h-12 w-full motion-reduce:animate-none" />
        </div>
      ) : isError ? (
        <ErrorState testId="guest-stays-error" title={t('guests.detailPage.staysLoadError')} error={error} onRetry={onRetry} />
      ) : sorted.length === 0 ? (
        <p className="text-foreground/70" data-testid="guest-stays-empty">
          {t('guests.noBookingsDescription')}
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border border-y border-border">
          {sorted.map((booking) => {
            const nights = bookingNights(booking);
            const when = [stayRangeText(booking, i18n.language, today), nights > 0 ? t('booking.list.nights', { count: nights }) : ''].filter(Boolean).join(' · ');
            return (
              <li key={booking.id}>
                <Link to={`${BOOKINGS_PATH}/${booking.id}`} className={ROW} data-testid={`guest-stay-${booking.id}`}>
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block break-words font-semibold group-hover/open:underline">{booking.propertyName || '—'}</span>
                    <span className="block break-words text-sm text-foreground/70">{when}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-medium tabular-nums">{formatCurrency(booking.totalPrice, booking.currency)}</span>
                    <StatusBadge kind="booking" status={booking.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PlainSection>
  );
}
