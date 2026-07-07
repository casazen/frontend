import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { formatCurrency } from '@/lib/utils';
import type { PublicPropertyDetailDto } from '@/types';

interface Availability {
  bookedDates: string[];
}

interface BookingWidgetProps {
  property: PublicPropertyDetailDto;
  availability?: Availability;
  orgSlug: string;
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
  compact = false,
}: BookingWidgetProps & { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

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

  const canCheckout = nights > 0 && dateRangeAvailable;

  return (
    <div className={`space-y-4 ${compact ? '' : 'public-site-card p-5'}`} data-testid="booking-widget">
      <h3 className="text-lg font-semibold">{t('publicBooking.propertyTitle')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="widget-check-in">{t('publicBooking.checkInLabel')}</Label>
          <Input id="widget-check-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="widget-check-out">{t('publicBooking.checkOutLabel')}</Label>
          <Input id="widget-check-out" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
      </div>

      {(checkIn && isDateBooked(checkIn)) || (checkOut && isDateBooked(checkOut)) || (checkIn && checkOut && !dateRangeAvailable) ? (
        <p className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {t('publicBooking.dateRangeBooked')}
        </p>
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
        onClick={() => navigate(`/book/${orgSlug}/property/${property.id}/checkout?checkIn=${checkIn}&checkOut=${checkOut}`)}
      >
        {t('publicBooking.proceedToCheckout')}
      </Button>
    </div>
  );
}

export function BookingWidget(props: BookingWidgetProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="hidden md:block md:sticky md:top-6">
        <WidgetForm {...props} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--cz-public-surface)] p-3 shadow-[var(--cz-public-shadow-widget)] md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="public-site-cta w-full border-0">{t('publicSite.mobileBookingCta')}</Button>
          </SheetTrigger>
          <SheetContent side="right" className="max-h-[85vh] overflow-y-auto rounded-t-2xl sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{t('publicBooking.propertyTitle')}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <WidgetForm {...props} compact />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
