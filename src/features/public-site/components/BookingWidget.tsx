import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { buildPropertyCheckoutUrl } from '@/lib/booking-url';
import { addDays, nightsBetween, todayInRome } from '@/lib/stay-dates';
import { useBookingSearchParams } from '@/features/public-site/hooks/use-booking-search-params';
import { AvailabilityCalendar, type AvailabilityStatus } from '@/features/public-site/components/AvailabilityCalendar';
import type { PublicPropertyDetailDto } from '@/types';

/** Public availability of the property (BK-05), as loaded by the page. */
export interface WidgetAvailability {
  status: AvailabilityStatus;
  /** Taken nights (`YYYY-MM-DD`); only meaningful when `status` is `ready`. */
  bookedDates?: string[];
  /** End of the loaded range (`YYYY-MM-DD`, excluded). */
  endDate?: string;
  /** Why the load failed, when `status` is `error`. */
  errorMessage?: string;
  onRetry: () => void;
}

interface BookingWidgetProps {
  property: PublicPropertyDetailDto;
  availability: WidgetAvailability;
  orgSlug: string;
}

/** True when a night of [checkIn, checkOut) is taken: the check-out day itself can be taken (same-day turnover). */
function stayHasTakenNight(checkIn: string, checkOut: string, booked: ReadonlySet<string>): boolean {
  for (let night = checkIn; night && night < checkOut; night = addDays(night, 1)) {
    if (booked.has(night)) return true;
  }
  return false;
}

function WidgetForm({
  property,
  availability,
  orgSlug,
  compact = false,
  onCheckout,
}: BookingWidgetProps & { compact?: boolean; onCheckout?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { params, setParams } = useBookingSearchParams();
  const [today] = useState(() => todayInRome());

  const checkIn = params.checkIn;
  const checkOut = params.checkOut;
  const guests = params.guests;

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const lodgingTotal = property.nightlyRate * nights;
  const estimatedTotal = lodgingTotal + property.cleaningFee;

  const bookedDates = useMemo(() => new Set(availability.bookedDates ?? []), [availability.bookedDates]);
  // Known only once the availability has loaded; the checkout checks the same nights again (409 when taken meanwhile).
  const selectionTaken = useMemo(() => {
    if (availability.status !== 'ready' || !checkIn) return false;
    if (nights > 0) return stayHasTakenNight(checkIn, checkOut, bookedDates);
    return bookedDates.has(checkIn);
  }, [availability.status, bookedDates, checkIn, checkOut, nights]);

  const checkInPast = !!checkIn && checkIn < today;
  const canCheckout = nights > 0 && !checkInPast && !selectionTaken && guests >= 1 && guests <= property.maxGuests;

  const handleCheckout = () => {
    navigate(buildPropertyCheckoutUrl(orgSlug, property, params));
    onCheckout?.();
  };

  return (
    <div className={`space-y-4 ${compact ? '' : 'public-site-card p-5'}`} data-testid="booking-widget">
      <h3 className="text-lg font-semibold">{t('publicBooking.propertyTitle')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="check-in">{t('publicBooking.checkInLabel')}</Label>
          <Input
            id="check-in"
            type="date"
            min={today}
            value={checkIn}
            onChange={(e) => setParams({ checkIn: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="check-out">{t('publicBooking.checkOutLabel')}</Label>
          <Input
            id="check-out"
            type="date"
            min={addDays(checkIn && checkIn >= today ? checkIn : today, 1)}
            value={checkOut}
            onChange={(e) => setParams({ checkOut: e.target.value })}
          />
        </div>
      </div>

      <AvailabilityCalendar
        bookedDates={bookedDates}
        status={availability.status}
        errorMessage={availability.errorMessage}
        onRetry={availability.onRetry}
        today={today}
        rangeEnd={availability.endDate}
      />

      <div className="space-y-1">
        <Label htmlFor="guests">{t('publicBooking.guestsLabel')}</Label>
        <Input
          id="guests"
          type="number"
          min={1}
          max={property.maxGuests}
          value={guests}
          onChange={(e) => setParams({ guests: Number(e.target.value) })}
        />
      </div>

      {checkInPast ? (
        <p className="text-sm text-red-600">{t('publicBooking.validation.checkInPast')}</p>
      ) : null}

      {selectionTaken ? (
        <p className="flex items-center gap-1 text-sm text-red-600" data-testid="booking-widget-dates-taken">
          <AlertCircle className="h-4 w-4" />
          {t('publicBooking.dateRangeBooked')}
        </p>
      ) : null}

      {guests > property.maxGuests ? (
        <p className="text-sm text-red-600">{t('publicBooking.maxGuestsExceeded', { count: property.maxGuests })}</p>
      ) : null}

      {nights > 0 ? (
        <div className="space-y-1 text-sm">
          <p>
            {t('publicBooking.nightsTimesRateTotal', {
              count: nights,
              rate: formatCurrency(property.nightlyRate),
              total: formatCurrency(lodgingTotal),
            })}
          </p>
          <p>{t('publicBooking.pulizia')}: {formatCurrency(property.cleaningFee)}</p>
          <p className="text-[var(--cz-public-muted)]">{t('publicBooking.tassaSoggiornoCalculated')}</p>
          <p className="text-base font-semibold">{t('publicBooking.totaleStimato', { amount: formatCurrency(estimatedTotal) })}</p>
        </div>
      ) : null}

      <Button
        className="public-site-cta w-full border-0"
        disabled={!canCheckout}
        onClick={handleCheckout}
      >
        {t('publicBooking.proceedToCheckout')}
      </Button>
    </div>
  );
}

export function BookingWidget(props: BookingWidgetProps) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <div id="booking-widget" className="hidden md:block md:sticky md:top-6">
        <WidgetForm {...props} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--cz-public-surface)] p-3 shadow-[var(--cz-public-shadow-widget)] md:hidden">
        <Button
          type="button"
          className="public-site-cta w-full border-0"
          data-testid="mobile-booking-trigger"
          onClick={() => setMobileOpen(true)}
        >
          {t('publicSite.mobileBookingCta')}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" data-testid="mobile-booking-sheet">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t('publicSite.closeBookingSheet')}
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--cz-public-surface)] p-4 shadow-[var(--cz-public-shadow-widget)] animate-in slide-in-from-bottom duration-300">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('publicBooking.propertyTitle')}</h3>
              <button
                type="button"
                className="rounded-md p-1 hover:bg-black/5"
                aria-label={t('publicSite.closeBookingSheet')}
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <WidgetForm {...props} compact onCheckout={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
