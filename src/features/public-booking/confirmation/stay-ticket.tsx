import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CreditCard, Info, Mail, MapPin, Users, XCircle, Check, Clock } from 'lucide-react';
import { useSiteMoney } from '@/features/public-site/hooks/use-site-money';
import { guestsSummary } from '@/features/public-site/stay/stay-format';
import type { OutcomeView } from '@/features/public-booking/checkout-outcome';
import { BookingCode } from '@/features/public-booking/confirmation/booking-code';
import {
  calendarPlace,
  chipOf,
  stayTimes,
  ticketNote,
  type ChipKind,
  type ConfirmationVariant,
  type TicketNote,
} from '@/features/public-booking/confirmation/confirmation-model';
import { displayableMediaUrls } from '@/lib/media-url';
import { siteLocale } from '@/lib/site-language';
import { formatStayDate, nightsBetween } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { CheckoutOutcome, PublicPropertyDetailDto } from '@/types';
import './confirmation.css';

function chipLabel(t: TFunction, kind: ChipKind): string {
  switch (kind) {
    case 'confirmed':
      return t('siteConfirm.chip.confirmed');
    case 'emailPending':
      return t('siteConfirm.chip.emailPending');
    case 'waiting':
      return t('siteConfirm.chip.waiting');
    case 'processing':
      return t('siteConfirm.chip.processing');
    case 'unpaid':
      return t('siteConfirm.chip.unpaid');
    case 'expired':
      return t('siteConfirm.chip.expired');
    case 'declined':
      return t('siteConfirm.chip.declined');
    case 'unavailable':
      return t('siteConfirm.chip.unavailable');
    case 'cancelled':
      return t('siteConfirm.chip.cancelled');
  }
}

function ChipIcon({ kind }: { kind: ChipKind }) {
  switch (kind) {
    case 'confirmed':
      return <Check aria-hidden />;
    case 'emailPending':
      return <Mail aria-hidden />;
    case 'unpaid':
      return <CreditCard aria-hidden />;
    case 'declined':
    case 'unavailable':
    case 'cancelled':
      return <XCircle aria-hidden />;
    case 'waiting':
    case 'processing':
    case 'expired':
      return <Clock aria-hidden />;
  }
}

function noteText(t: TFunction, note: TicketNote, outcome: CheckoutOutcome, language: string): string {
  switch (note) {
    case 'paid':
      return t('siteConfirm.note.paid');
    case 'onSite':
      return t('siteConfirm.note.onSite');
    case 'later':
      return t('siteConfirm.note.later', { date: formatStayDate(outcome.deferredChargeDate ?? '', siteLocale(language)) });
    case 'request':
      return t('siteConfirm.note.request');
    case 'processing':
      return t('siteConfirm.note.processing');
    case 'unpaid':
      return t('siteConfirm.note.unpaid');
  }
}

function DayBlock({ label, date, hint, locale }: { label: string; date: string; hint: string; locale: string }) {
  return (
    <p className="bc-ticket__d">
      <span className="bc-k">{label}</span>
      <span className="bc-ticket__day" aria-hidden="true">
        <strong>{formatStayDate(date, locale, { day: 'numeric' })}</strong>
        <span>{formatStayDate(date, locale, { month: 'short' })}</span>
      </span>
      <span className="bc-ticket__wd" aria-hidden="true">
        {formatStayDate(date, locale, { weekday: 'long' })}
      </span>
      <span className="sr-only">{formatStayDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      {hint ? <small>{hint}</small> : null}
    </p>
  );
}

interface StayTicketProps {
  outcome: CheckoutOutcome;
  /** The public record of the house: the photo, the zone and the hours. The ticket is complete without it. */
  property: PublicPropertyDetailDto | undefined;
  view: OutcomeView;
  variant: ConfirmationVariant;
}

/**
 * The «biglietto» of the stay (DB-06b): the photo with the state of the booking, the house and where it is, the two days big, the
 * guests, the total (the one of the backend, never added up here), one line on the money, and the code with «Copia». What the booking
 * does not have is left out, not drawn empty: no photo, no hours, no zone. A request says in plain words that it is not a booking yet.
 */
export function StayTicket({ outcome, property, view, variant }: StayTicketProps) {
  const { t, i18n } = useTranslation();
  const money = useSiteMoney();
  const locale = siteLocale(i18n.language);
  const photo = displayableMediaUrls(property?.photoUrls ?? [])[0];
  const place = calendarPlace(property, i18n.language);
  const { arrivalFrom, departureBy } = stayTimes(property);
  const chip = chipOf(view);
  const note = ticketNote(variant, outcome);
  const nights = nightsBetween(outcome.checkInDate, outcome.checkOutDate);
  const guests = outcome.numberOfAdults + outcome.numberOfChildren;

  const chipNode = (
    <span className={cn('bc-chip', `bc-chip--${chip.tone}`)} data-testid="checkout-outcome-chip">
      <ChipIcon kind={chip.kind} />
      <span>{chipLabel(t, chip.kind)}</span>
    </span>
  );

  return (
    <article className="bc-ticket" aria-label={t('siteConfirm.ticket.label', { home: outcome.propertyName })} data-testid="checkout-outcome-summary">
      <div className="bc-ticket__top">
        {photo ? (
          <div className="bc-ticket__media">
            <img src={photo} alt="" decoding="async" />
            <span className="bc-ticket__chip">{chipNode}</span>
          </div>
        ) : (
          <div className="bc-ticket__chipline">{chipNode}</div>
        )}
        <div className="bc-ticket__head">
          <p className="bc-ticket__name public-display">{outcome.propertyName}</p>
          {place ? (
            <p className="bc-ticket__zone">
              <MapPin aria-hidden />
              <span>{place}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="bc-ticket__bottom">
        <div className="bc-ticket__dates">
          <DayBlock
            label={t('siteConfirm.ticket.arrival')}
            date={outcome.checkInDate}
            hint={arrivalFrom ? t('siteConfirm.ticket.from', { time: arrivalFrom }) : ''}
            locale={locale}
          />
          {nights > 0 ? (
            <span className="bc-ticket__n" aria-hidden="true">
              <i />
              <span>{t('publicCheckout.summary.nights', { count: nights })}</span>
              <i />
            </span>
          ) : (
            <span />
          )}
          <DayBlock
            label={t('siteConfirm.ticket.departure')}
            date={outcome.checkOutDate}
            hint={departureBy ? t('siteConfirm.ticket.by', { time: departureBy }) : ''}
            locale={locale}
          />
        </div>

        <p className="bc-ticket__facts">
          <span>
            <Users aria-hidden />
            {guestsSummary(t, outcome.numberOfAdults, outcome.numberOfChildren, false)}
            {outcome.numberOfChildren > 0 && guests > 1 ? <small>{t('siteConfirm.ticket.ofWhichChildren', { count: outcome.numberOfChildren })}</small> : null}
          </span>
          <span>
            {t('siteConfirm.ticket.total')} <strong data-testid="checkout-outcome-total">{money(outcome.totalPrice, outcome.currency)}</strong>
          </span>
        </p>

        {note ? (
          <p className="bc-ticket__note" data-testid="checkout-outcome-note">
            <Info aria-hidden />
            <span>{noteText(t, note, outcome, i18n.language)}</span>
          </p>
        ) : null}

        {outcome.bookingCode ? <BookingCode code={outcome.bookingCode} /> : null}
      </div>
    </article>
  );
}
