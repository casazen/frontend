import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { FROM_DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { formatPrice, formatStayRange } from '@/features/public-site/stay/stay-format';
import { BookingCard, BookingCta, type OpenSheet } from '@/features/public-booking/booking/booking-card';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { quoteTotalCents } from '@/features/public-booking/booking/quote-helpers';
import { siteLocale } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import '@/features/public-booking/booking/booking.css';

/**
 * The bar at the foot of the page on a phone and a tablet (DB-04b): the price (the total of the server for the dates chosen, else
 * «da … / notte»), the dates, and «Prenota». The price opens a sheet with the same card, the calendar and the guests already open;
 * choosing there updates the bar behind it at once. From a desktop up there is no bar: the card is fixed beside the page. It sits under
 * the cookie banner (z-index in `booking.css`) and the page leaves room for it (`pb-24` of the shell), so it covers no content.
 */
export function BookingBar() {
  const { t, i18n } = useTranslation();
  const isDesktop = useMediaQuery(FROM_DESKTOP_QUERY);
  const portal = usePortalRootProps();
  const model = useBooking();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { quote, fromPriceCents, currency, stay, online, acceptsBookings, checkoutHref, property } = model;
  const locale = siteLocale(i18n.language);

  if (isDesktop) return null;

  const money = (cents: number) => formatPrice(cents, currency, locale);
  const ready = quote.status === 'ready' ? quote.quote : null;

  let info: { main: ReactNode; sub: ReactNode };
  if (ready) {
    info = {
      main: (
        <>
          {money(quoteTotalCents(ready))} <small>{t('propertyBooking.bar.total')}</small>
        </>
      ),
      sub: (
        <>
          {formatStayRange(stay.checkIn, stay.checkOut, locale)} · <u>{t('propertyBooking.bar.edit')}</u>
        </>
      ),
    };
  } else {
    const from = fromPriceCents !== null ? `${t('propertyBooking.price.from')} ${money(fromPriceCents)}` : '';
    info = {
      main: (
        <>
          {from} <small>/ {t('propertyBooking.price.night')}</small>
        </>
      ),
      sub:
        quote.status === 'problem' || quote.status === 'error'
          ? t('propertyBooking.bar.problem')
          : stay.checkIn
            ? t('propertyBooking.bar.chooseDeparture')
            : t('propertyBooking.bar.addDates'),
    };
  }

  // The sheet already shows the calendar and the guests: a request to choose them takes the focus there.
  const reach = (what: Exclude<OpenSheet, null>) => {
    const scope = sheetRef.current;
    const target =
      what === 'dates'
        ? scope?.querySelector<HTMLElement>('[data-date][tabindex="0"]')
        : scope?.querySelector<HTMLElement>('[data-testid="guests-adults"] button, [data-testid="guests-picker"] button');
    target?.focus();
  };

  const focusInside = (event: Event) => {
    const target = sheetRef.current?.querySelector<HTMLElement>('[data-date][tabindex="0"]');
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  const ctaClass = 'public-site-cta pp-dock__cta inline-flex items-center justify-center border-0 text-base';

  let cta: ReactNode;
  if (!acceptsBookings) cta = null;
  else if (!online) {
    cta = (
      <button type="button" className={ctaClass} aria-disabled="true" data-testid="booking-bar-cta">
        <WifiOff className="mr-2 h-4 w-4" aria-hidden />
        {t('propertyBooking.bar.offline')}
      </button>
    );
  } else if (quote.status === 'ready' && checkoutHref) {
    cta = (
      <Link to={checkoutHref} className={ctaClass} data-testid="booking-bar-cta">
        {t('propertyBooking.cta.book')}
      </Link>
    );
  } else {
    cta = (
      <button type="button" className={ctaClass} onClick={() => setOpen(true)} data-testid="booking-bar-cta">
        {stay.checkIn ? t('propertyBooking.bar.change') : t('propertyBooking.cta.chooseDates')}
      </button>
    );
  }

  return (
    <>
      <div className="pp-dock" role="region" aria-label={t('propertyBooking.bar.label', { name: property.name })} data-testid="booking-bar">
        <button
          type="button"
          className="pp-dock__info"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          data-testid="mobile-booking-trigger"
        >
          <strong>{info.main}</strong>
          <span>{info.sub}</span>
        </button>
        {cta}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          {...portal}
          ref={sheetRef}
          side="bottom"
          className={cn(portal.className, 'stay-sheet')}
          data-testid="booking-sheet"
          onOpenAutoFocus={focusInside}
        >
          <SheetTitle className="stay-sheet__title">{t('propertyBooking.sheet.title', { name: property.name })}</SheetTitle>
          <SheetDescription className="sr-only">{t('propertyBooking.sheet.description')}</SheetDescription>
          <div className="stay-sheet__body">
            <BookingCard variant="sheet" />
          </div>
          <div className="stay-sheet__foot">
            <BookingCta onChoose={reach} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
