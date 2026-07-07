import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { useBookingSearchParams } from '@/features/public-site/hooks/use-booking-search-params';
import type { PublicPropertyDetailDto } from '@/types';

interface Availability {
  bookedDates: string[];
}

interface BookingWidgetProps {
  property: PublicPropertyDetailDto;
  availability?: Availability;
  orgSlug: string;
  querySuffix?: string;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
}

function WidgetForm({
  property,
  availability,
  orgSlug,
  querySuffix = '',
  compact = false,
  onCheckout,
}: BookingWidgetProps & { compact?: boolean; onCheckout?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { params, setParams } = useBookingSearchParams();

  const checkIn = params.checkIn;
  const checkOut = params.checkOut;
  const guests = params.guests;

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const lodgingTotal = property.nightlyRate * nights;
  const estimatedTotal = lodgingTotal + property.cleaningFee;

  const isDateBooked = (dateStr: string) => availability?.bookedDates.includes(dateStr) ?? false;
  const dateRangeAvailable = useMemo(() => {
    if (!checkIn || !checkOut || !availability) return true;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const current = new Date(start);
    while (current < end) {
      if (availability.bookedDates.includes(current.toISOString().split('T')[0])) return false;
      current.setDate(current.getDate() + 1);
    }
    return true;
  }, [checkIn, checkOut, availability]);

  const canCheckout = nights > 0 && dateRangeAvailable && guests >= 1 && guests <= property.maxGuests;

  const handleCheckout = () => {
    const qs = querySuffix || [
      checkIn ? `checkIn=${checkIn}` : '',
      checkOut ? `checkOut=${checkOut}` : '',
      guests !== 2 ? `guests=${guests}` : '',
    ].filter(Boolean).join('&');
    navigate(`/book/${orgSlug}/property/${property.id}/checkout${qs ? `?${qs}` : ''}`);
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
            value={checkIn}
            onChange={(e) => setParams({ checkIn: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="check-out">{t('publicBooking.checkOutLabel')}</Label>
          <Input
            id="check-out"
            type="date"
            value={checkOut}
            onChange={(e) => setParams({ checkOut: e.target.value })}
          />
        </div>
      </div>

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

      {(checkIn && isDateBooked(checkIn)) || (checkOut && isDateBooked(checkOut)) || (checkIn && checkOut && !dateRangeAvailable) ? (
        <p className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {t('publicBooking.dateRangeBooked')}
        </p>
      ) : null}

      {guests > property.maxGuests ? (
        <p className="text-sm text-red-600">{t('publicBooking.maxGuestsExceeded', { max: property.maxGuests })}</p>
      ) : null}

      {nights > 0 ? (
        <div className="space-y-1 text-sm">
          <p>
            {nights} {t('publicBooking.notte')}{nights !== 1 ? 'i' : ''} × {formatCurrency(property.nightlyRate)} = {formatCurrency(lodgingTotal)}
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
