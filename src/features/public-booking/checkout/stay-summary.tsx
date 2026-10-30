import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, ChevronUp, Info, Pencil } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FROM_DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { formatDayMonth, formatPrice, guestsSummary } from '@/features/public-site/stay/stay-format';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { PriceLines } from '@/features/public-booking/booking/price-lines';
import { quoteTotalCents } from '@/features/public-booking/booking/quote-helpers';
import { policyStages } from '@/features/public-booking/lib/property-profile';
import type { CheckoutMode } from '@/features/public-booking/checkout/checkout-model';
import { displayableMediaUrls } from '@/lib/media-url';
import { siteLocale } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import '@/features/public-booking/checkout/checkout.css';

interface StaySummaryProps {
  mode: CheckoutMode;
  /** Takes the guest back to the first step; absent once the booking is made, when the stay is fixed. */
  onEdit?: () => void;
  variant?: 'aside' | 'sheet';
}

/** What the cancellation gives back for these dates, only if the system keeps the promise (the guest can cancel by themselves). */
function cancellationLine(model: ReturnType<typeof useBooking>, language: string, t: TFunction): string | null {
  const { quote, property } = model;
  if (quote.status !== 'ready') return null;
  const dates = quote.quote.cancellation;
  if (!dates?.selfServiceAvailable) return null;
  const locale = siteLocale(language);
  if (dates.fullRefundUntil) return t('propertyBooking.trust.freeUntil', { date: formatDayMonth(dates.fullRefundUntil, locale) });
  if (dates.partialRefundUntil && dates.partialRefundPercent) {
    return t('publicCheckout.summary.partialUntil', { percent: dates.partialRefundPercent, date: formatDayMonth(dates.partialRefundUntil, locale) });
  }
  const hadFull = property.cancellationPolicy ? policyStages(property.cancellationPolicy).full : null;
  return hadFull ? t('propertyBooking.trust.freeOver') : null;
}

/**
 * The summary of the booking, always in sight (DB-05): the house, the dates, the guests, how it is booked, the lines of the price as the
 * server sends them (never added up here), and what a cancellation gives back for these dates. A desktop has it as a receipt on the
 * right; a phone as a sheet behind the bar. The new total is announced when it changes.
 */
export function StaySummary({ mode, onEdit, variant = 'aside' }: StaySummaryProps) {
  const { t, i18n } = useTranslation();
  const model = useBooking();
  const { property, stay, nights, quote, currency } = model;
  const locale = siteLocale(i18n.language);
  const photo = displayableMediaUrls(property.photoUrls)[0];
  const place = property.city?.trim() ?? '';
  const shown = quote.status === 'ready' ? quote : quote.status === 'loading' && quote.stale ? { quote: quote.stale, estimatedTax: false } : null;
  const cancel = cancellationLine(model, i18n.language, t);

  return (
    <section className={cn('co-sum', variant === 'sheet' && 'co-sum--sheet')} aria-labelledby={`co-sum-title-${variant}`} data-testid="checkout-summary">
      <p role="status" aria-live="polite" className="sr-only">
        {quote.status === 'ready'
          ? t('publicCheckout.summary.updated', { total: formatPrice(quoteTotalCents(quote.quote), currency, locale), count: quote.quote.nights || nights })
          : ''}
      </p>

      <div className="co-sum__top">
        {photo ? (
          <span className="co-sum__pic" aria-hidden="true">
            <img src={photo} alt="" loading="lazy" decoding="async" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 id={`co-sum-title-${variant}`} className="co-sum__name public-display">
            {property.name}
          </h2>
          {place ? <p className="co-sum__zone">{place}</p> : null}
        </div>
      </div>

      <dl className="co-sum__stay" data-testid="checkout-stay-summary">
        <div>
          <dt>{t('publicCheckout.summary.dates')}</dt>
          <dd>
            {stay.checkIn && stay.checkOut
              ? `${formatDayMonth(stay.checkIn, locale)} – ${formatDayMonth(stay.checkOut, locale)}`
              : t('publicCheckout.summary.noDates')}
            {nights > 0 ? <small>{t('publicCheckout.summary.nights', { count: nights })}</small> : null}
          </dd>
        </div>
        <div>
          <dt>{t('publicCheckout.summary.guests')}</dt>
          <dd>{guestsSummary(t, stay.adults, stay.children, stay.pets)}</dd>
        </div>
        <div>
          <dt>{t('publicCheckout.summary.confirmation')}</dt>
          <dd>{mode === 'request' ? t('publicCheckout.summary.onRequest') : t('publicCheckout.summary.instant')}</dd>
        </div>
      </dl>

      {shown ? (
        <PriceLines quote={shown.quote} estimatedTax={shown.estimatedTax} stale={quote.status === 'loading'} idPrefix={`co-sum-${variant}`} />
      ) : (
        <p className="co-sum__wait" role="status">
          {quote.status === 'loading' ? t('propertyBooking.price.calculating') : t('publicCheckout.summary.noPrice')}
        </p>
      )}

      {cancel ? (
        <p className="co-sum__cancel">
          <CalendarCheck aria-hidden />
          <span>{cancel}</span>
        </p>
      ) : null}

      {onEdit ? (
        <button type="button" className="co-sum__edit" onClick={onEdit} data-testid="checkout-edit-stay">
          <Pencil aria-hidden />
          {t('publicCheckout.summary.edit')}
        </button>
      ) : (
        <p className="co-sum__cancel">
          <Info aria-hidden />
          <span>{t('publicCheckout.summary.locked')}</span>
        </p>
      )}
    </section>
  );
}

/**
 * On a phone and a tablet the summary is behind a bar at the foot of the page: «Totale · Dettagli». The bar leaves room for itself
 * (`pb-24` of the page) so it covers no button.
 */
export function SummaryBar({ mode, onEdit }: Pick<StaySummaryProps, 'mode' | 'onEdit'>) {
  const { t, i18n } = useTranslation();
  const isDesktop = useMediaQuery(FROM_DESKTOP_QUERY);
  const portal = usePortalRootProps();
  const { quote, currency } = useBooking();
  const [open, setOpen] = useState(false);
  const locale = siteLocale(i18n.language);
  if (isDesktop) return null;

  const total = quote.status === 'ready' ? quote.quote : quote.status === 'loading' ? quote.stale : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="co-bar" data-testid="checkout-summary-bar">
        <SheetTrigger asChild>
          <button type="button" className="co-bar__btn" aria-haspopup="dialog">
            <span className="co-bar__total">
              <small>{t('publicCheckout.summary.total')}</small>
              <strong data-testid="checkout-bar-total">{total ? formatPrice(quoteTotalCents(total), currency, locale) : '—'}</strong>
            </span>
            <span className="co-bar__more">
              {t('publicCheckout.summary.details')}
              <ChevronUp aria-hidden />
            </span>
          </button>
        </SheetTrigger>
      </div>
      <SheetContent {...portal} side="bottom" className={cn(portal.className, 'stay-sheet')} data-testid="checkout-summary-sheet">
        <SheetTitle className="stay-sheet__title">{t('publicCheckout.summary.title')}</SheetTitle>
        <SheetDescription className="sr-only">{t('publicCheckout.summary.description')}</SheetDescription>
        <div className="stay-sheet__body">
          <StaySummary
            mode={mode}
            variant="sheet"
            onEdit={
              onEdit
                ? () => {
                    setOpen(false);
                    onEdit();
                  }
                : undefined
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
