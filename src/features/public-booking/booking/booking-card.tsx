import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarCheck, Check, ChevronDown, Info, Lock, Mail, Receipt, WifiOff, Zap } from 'lucide-react';
import { GuestsPicker } from '@/features/public-site/stay/guests-picker';
import { StayCalendar } from '@/features/public-site/stay/stay-calendar';
import { StaySheet } from '@/features/public-site/stay/stay-sheet';
import { formatDayMonth, formatDayMonthShort, formatPrice, guestsSummary } from '@/features/public-site/stay/stay-format';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { PriceLines } from '@/features/public-booking/booking/price-lines';
import { quoteTotalCents } from '@/features/public-booking/booking/quote-helpers';
import { StayProblem } from '@/features/public-booking/booking/stay-problem';
import { policyStages } from '@/features/public-booking/lib/property-profile';
import { siteLocale } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import '@/features/public-booking/booking/booking.css';

/** What a call to action can ask to open or reach: the dates or the guests. */
export type OpenSheet = 'dates' | 'guests' | null;

/** The price at the top of the card: «da 145 € / notte» before the dates, the total of the server for the dates chosen after them. */
function PriceHead() {
  const { t, i18n } = useTranslation();
  const { quote, fromPriceCents, currency, nights } = useBooking();
  const locale = siteLocale(i18n.language);
  const money = (cents: number) => formatPrice(cents, currency, locale);
  const shown = quote.status === 'ready' ? quote.quote : quote.status === 'loading' ? quote.stale : null;

  if (shown) {
    const total = quoteTotalCents(shown);
    const count = shown.nights || nights;
    return (
      <div>
        <p className="pp-price" data-stale={quote.status === 'loading' || undefined} data-testid="booking-price">
          <strong className="pp-price__n">
            <span key={total} className="pp-flash rounded-md">
              {money(total)}
            </span>
          </strong>
          <span>{t('propertyBooking.price.totalFor', { count })}</span>
        </p>
        {count > 0 ? <p className="pp-price__sub">{t('propertyBooking.price.average', { price: money(Math.round(total / count)) })}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <p className="pp-price" data-testid="booking-price">
        {fromPriceCents !== null ? (
          <>
            <span>{t('propertyBooking.price.from')}</span>
            <strong className="pp-price__n">{money(fromPriceCents)}</strong>
            <span>/ {t('propertyBooking.price.night')}</span>
          </>
        ) : null}
      </p>
      <p className="pp-price__sub">{quote.status === 'loading' ? t('propertyBooking.price.calculating') : t('propertyBooking.price.chooseDates')}</p>
    </div>
  );
}

function ModeLine() {
  const { t } = useTranslation();
  const { acceptsBookings } = useBooking();
  if (!acceptsBookings) return null;
  return (
    <p className="pp-mode">
      <Zap aria-hidden />
      <span>
        <strong>{t('propertyBooking.mode.instant')}</strong> · {t('propertyBooking.mode.request')}
      </span>
    </p>
  );
}

/** Arrival and departure as one button (they open the same calendar), and the guests as another under it. */
function FieldButtons({ open, onOpenChange }: { open: OpenSheet; onOpenChange: (next: OpenSheet) => void }) {
  const { t, i18n } = useTranslation();
  const { stay, setStay, calendar, property, petsAllowed } = useBooking();
  const locale = siteLocale(i18n.language);
  const value = { checkIn: stay.checkIn, checkOut: stay.checkOut, adults: stay.adults, children: stay.children, pets: stay.pets };
  const day = (date: string) => (date ? formatDayMonthShort(date, locale) : '');

  return (
    <div className="pp-fields">
      <StaySheet
        section="dates"
        open={open === 'dates'}
        onOpenChange={(next) => onOpenChange(next ? 'dates' : null)}
        trigger={
          <button type="button" className="pp-field pp-field--dates" aria-haspopup="dialog" data-testid="booking-dates">
            <span>
              <span className="pp-field__label">{t('propertyBooking.fields.arrival')}</span>
              <span className={cn('pp-field__value', !stay.checkIn && 'is-empty')}>{day(stay.checkIn) || t('propertyBooking.fields.add')}</span>
            </span>
            <span>
              <span className="pp-field__label">{t('propertyBooking.fields.departure')}</span>
              <span className={cn('pp-field__value', !stay.checkOut && 'is-empty')}>{day(stay.checkOut) || t('propertyBooking.fields.add')}</span>
            </span>
          </button>
        }
        value={value}
        onChange={setStay}
        calendar={calendar}
        maxGuests={property.maxGuests}
        petsAllowed={petsAllowed}
        title={t('propertyBooking.fields.datesTitle')}
      />
      <StaySheet
        section="guests"
        open={open === 'guests'}
        onOpenChange={(next) => onOpenChange(next ? 'guests' : null)}
        trigger={
          <button type="button" className="pp-field pp-field--who" aria-haspopup="dialog" data-testid="booking-guests">
            <span>
              <span className="pp-field__label">{t('propertyBooking.fields.guests')}</span>
              <span className="pp-field__value">{guestsSummary(t, stay.adults, stay.children, stay.pets)}</span>
            </span>
            <ChevronDown aria-hidden />
          </button>
        }
        value={value}
        onChange={setStay}
        calendar={calendar}
        maxGuests={property.maxGuests}
        petsAllowed={petsAllowed}
        title={t('propertyBooking.fields.guestsTitle')}
      />
    </div>
  );
}

/** The same choices already open, for the sheet of the phone: the calendar and the guests one under the other. */
function InlinePickers() {
  const { t } = useTranslation();
  const uid = useId();
  const { stay, setStay, calendar, property, petsAllowed } = useBooking();
  const value = { checkIn: stay.checkIn, checkOut: stay.checkOut, adults: stay.adults, children: stay.children, pets: stay.pets };

  return (
    <>
      <section aria-labelledby={`${uid}-dates`} className="space-y-2.5 border-t pt-4">
        <h3 id={`${uid}-dates`} className="public-display text-lg font-semibold">
          {t('propertyBooking.sheet.dates')}
        </h3>
        <StayCalendar value={value} onChange={setStay} data={calendar} layout="scroll" />
      </section>
      <section aria-labelledby={`${uid}-guests`} className="space-y-2.5 border-t pt-4">
        <h3 id={`${uid}-guests`} className="public-display text-lg font-semibold">
          {t('propertyBooking.sheet.guests')}
        </h3>
        <GuestsPicker value={value} onChange={setStay} maxGuests={property.maxGuests} petsAllowed={petsAllowed} />
      </section>
    </>
  );
}

/** Why the stay cannot be booked yet, or what to do next: always in a live region, so the change is heard. */
function Messages() {
  const { t, i18n } = useTranslation();
  const { quote, online, stay, nights, acceptsBookings } = useBooking();
  const locale = siteLocale(i18n.language);

  let content: ReactNode = null;
  if (!acceptsBookings) {
    content = null; // said by the call to action, with the way to write to the host
  } else if (!online) {
    content = (
      <div className="pp-msg pp-msg--info" data-testid="booking-offline">
        <p>
          <WifiOff aria-hidden />
          <span>{t('propertyBooking.offline')}</span>
        </p>
      </div>
    );
  } else if (quote.status === 'problem') {
    content = <StayProblem problem={quote} />;
  } else if (quote.status === 'error') {
    content = (
      <div className="pp-msg pp-msg--err" data-testid="booking-quote-error">
        <p>
          <Info aria-hidden />
          <span>{quote.message}</span>
        </p>
      </div>
    );
  } else if (stay.checkIn && nights === 0) {
    content = (
      <div className="pp-msg pp-msg--hint">
        <p>
          <CalendarCheck aria-hidden />
          <span>{t('propertyBooking.hint.chooseDeparture', { date: formatDayMonth(stay.checkIn, locale) })}</span>
        </p>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="pp-region">
      {content}
    </div>
  );
}

/** «Prenota» when the quote of this stay is in; otherwise the one thing to do next. Never a button that leads to a wrong total. */
function Cta({ onChoose }: { onChoose: (what: Exclude<OpenSheet, null>) => void }) {
  const { t } = useTranslation();
  const { quote, online, acceptsBookings, checkoutHref, hostLabel, contactEmail } = useBooking();
  const base = 'public-site-cta pp-book__cta border-0';

  if (!acceptsBookings) {
    return (
      <div className="pp-msg pp-msg--info" data-testid="booking-not-bookable">
        <p>
          <Info aria-hidden />
          <span>{t('propertyBooking.notBookable.text')}</span>
        </p>
        {contactEmail ? (
          <a className="pp-alt" href={`mailto:${contactEmail}`}>
            <Mail aria-hidden />
            <span>{t('propertyBooking.notBookable.write', { host: hostLabel })}</span>
            <ArrowRight aria-hidden />
          </a>
        ) : null}
      </div>
    );
  }

  if (!online) {
    return (
      <button type="button" className={base} aria-disabled="true" data-testid="booking-cta">
        <WifiOff className="h-5 w-5" aria-hidden />
        {t('propertyBooking.cta.offline')}
      </button>
    );
  }

  switch (quote.status) {
    case 'ready':
      return checkoutHref ? (
        <Link to={checkoutHref} className={base} data-testid="booking-cta">
          {t('propertyBooking.cta.book')}
        </Link>
      ) : null;
    case 'loading':
      return (
        <button type="button" className={base} aria-disabled="true" aria-busy="true" data-testid="booking-cta">
          {t('propertyBooking.cta.calculating')}
        </button>
      );
    case 'error':
      return (
        <button type="button" className={base} onClick={quote.retry} data-testid="booking-cta">
          {t('propertyBooking.cta.retry')}
        </button>
      );
    case 'problem':
      if (quote.problem === 'notBookable') return null;
      return (
        <button type="button" className={base} onClick={() => onChoose(quote.problem === 'tooManyGuests' ? 'guests' : 'dates')} data-testid="booking-cta">
          {quote.problem === 'tooManyGuests' ? t('propertyBooking.cta.changeGuests') : t('propertyBooking.cta.otherDates')}
        </button>
      );
    case 'none':
      return (
        <button type="button" className={base} onClick={() => onChoose('dates')} data-testid="booking-cta">
          {t('propertyBooking.cta.chooseDates')}
        </button>
      );
  }
}

/** The call to action with the line under it: what the bar and the sheet of the phone show, and the card of the desktop. */
export function BookingCta({ onChoose }: { onChoose: (what: Exclude<OpenSheet, null>) => void }) {
  const { t } = useTranslation();
  const { quote } = useBooking();
  return (
    <>
      <Cta onChoose={onChoose} />
      {quote.status === 'ready' ? (
        <p className="pp-book__note">
          <Check aria-hidden />
          <span>{t('propertyBooking.cta.nothingYet')}</span>
        </p>
      ) : null}
    </>
  );
}

/** Three reasons to trust the booking, each only if it is true for this stay. */
function Trust() {
  const { t, i18n } = useTranslation();
  const { quote, property, acceptsBookings } = useBooking();
  const locale = siteLocale(i18n.language);
  const ready = quote.status === 'ready' ? quote.quote : null;

  // The cancellation, in the dates of this stay when there are some, else in the words of the policy; nothing if the policy never refunds.
  let cancel: string | null = null;
  const dates = ready?.cancellation;
  const policyFull = property.cancellationPolicy ? policyStages(property.cancellationPolicy).full : null;
  if (ready && dates?.selfServiceAvailable && dates.fullRefundUntil) {
    cancel = t('propertyBooking.trust.freeUntil', { date: formatDayMonth(dates.fullRefundUntil, locale) });
  } else if (ready && dates?.selfServiceAvailable && policyFull) {
    cancel = t('propertyBooking.trust.freeOver');
  } else if (!ready && policyFull) {
    cancel =
      policyFull.count === 0
        ? t('publicProperty.rules.stage.fullStart')
        : t(policyFull.unit === 'day' ? 'publicProperty.rules.stage.fullDays' : 'publicProperty.rules.stage.fullHours', { count: policyFull.count });
  }

  const showFees = ready?.touristTax.status === 'Calculated';

  return (
    <ul className="pp-trust" data-testid="booking-trust">
      {acceptsBookings ? (
        <li>
          <Lock aria-hidden />
          <span>{t('propertyBooking.trust.stripe')}</span>
        </li>
      ) : null}
      {showFees ? (
        <li>
          <Receipt aria-hidden />
          <span>{t('propertyBooking.trust.noHiddenCosts')}</span>
        </li>
      ) : null}
      {cancel ? (
        <li>
          <CalendarCheck aria-hidden />
          <span>{cancel}</span>
        </li>
      ) : null}
    </ul>
  );
}

interface BookingCardProps {
  /** `aside`: the fixed card of the desktop. `sheet`: the same card inside the sheet of the phone, with the calendar and the guests open. */
  variant?: 'aside' | 'sheet';
}

/**
 * The booking card (DB-04b), alive: the price, how the home is booked, the dates and guests, what is wrong with them and the way out,
 * the call to action and the lines of the price. A change of dates or guests rewrites the address (replace) and asks the server
 * for the quote again; the card updates in place, the page is not drawn again and the focus stays where it is. The total is
 * always the quote of the server and is announced when it changes.
 */
export function BookingCard({ variant = 'aside' }: BookingCardProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<OpenSheet>(null);
  const { quote, hostLabel, contactEmail, nights } = useBooking();
  const locale = siteLocale(i18n.language);
  const sheet = variant === 'sheet';
  const lines = quote.status === 'ready' ? quote : quote.status === 'loading' && quote.stale ? { quote: quote.stale, estimatedTax: false } : null;

  return (
    <div className={cn('pp-book', sheet && 'pp-book--sheet')} data-testid={sheet ? 'booking-card-sheet' : 'booking-card'} aria-busy={quote.status === 'loading' || undefined}>
      {/* The new total is read out when it arrives, once: the figures in the card change without moving the focus. */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="booking-announce">
        {quote.status === 'ready'
          ? t('propertyBooking.announce.total', {
              total: formatPrice(quoteTotalCents(quote.quote), quote.quote.currency || 'EUR', locale),
              count: quote.quote.nights || nights,
            })
          : ''}
      </p>

      <PriceHead />
      <ModeLine />
      {sheet ? <InlinePickers /> : <FieldButtons open={open} onOpenChange={setOpen} />}
      <Messages />
      {sheet ? null : <BookingCta onChoose={setOpen} />}
      {lines ? <PriceLines quote={lines.quote} estimatedTax={lines.estimatedTax} stale={quote.status === 'loading'} /> : null}
      <Trust />
      {sheet ? null : contactEmail ? (
        <p className="pp-ask">
          {t('propertyBooking.ask')}{' '}
          <a href={`mailto:${contactEmail}`}>{t('publicProperty.host.write', { host: hostLabel })}</a>
        </p>
      ) : null}
    </div>
  );
}
