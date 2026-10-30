import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarPlus, Loader2, Mail, RefreshCw, WifiOff } from 'lucide-react';
import { HOST_ACTION_CLASS, HostCard } from '@/features/public-booking/components/host-card';
import { AddToCalendarSheet } from '@/features/public-booking/confirmation/add-to-calendar-sheet';
import type { CalendarStay } from '@/features/public-booking/confirmation/build-ics';
import { ConfirmationHero, type SealKind } from '@/features/public-booking/confirmation/confirmation-hero';
import {
  buildNextSteps,
  calendarPlace,
  confirmationVariant,
  formatStayRangeLong,
  stayTimes,
} from '@/features/public-booking/confirmation/confirmation-model';
import { NextSteps } from '@/features/public-booking/confirmation/next-steps';
import { ResumePayment } from '@/features/public-booking/confirmation/resume-payment';
import { StayTicket } from '@/features/public-booking/confirmation/stay-ticket';
import type { ClientPaymentStatus, OutcomeView } from '@/features/public-booking/checkout-outcome';
import { useSiteMoney } from '@/features/public-site/hooks/use-site-money';
import { buildGuestBookingsPath, buildPropertyPageUrl } from '@/lib/booking-url';
import { siteLocale } from '@/lib/site-language';
import { formatRomeDateTime, formatStayDate, todayInRome } from '@/lib/stay-dates';
import type { CheckoutOutcome, PublicOrgDto, PublicPropertyDetailDto } from '@/types';
import './confirmation.css';

const CTA = 'public-site-cta bc-cta border-0';
const CTA_QUIET = 'public-site-outline bc-cta bc-cta--quiet';

interface ConfirmationScreenProps {
  view: OutcomeView;
  outcome: CheckoutOutcome;
  org: PublicOrgDto;
  orgSlug: string;
  token: string;
  /** The public record of the house, for the photo, the zone, the hours and the host; the screen is complete without it. */
  property: PublicPropertyDetailDto | undefined;
  clientStatus: ClientPaymentStatus | null;
  /** What the checkout hands over for this page only (never through the address): the email and the first name the guest booked with. */
  guestEmail?: string;
  guestFirstName?: string;
  pollingStopped: boolean;
  refreshing: boolean;
  online: boolean;
  onRefresh: () => void;
  onPaymentSubmitted: (status: ClientPaymentStatus) => void;
}

function PollingNote() {
  const { t } = useTranslation();
  return (
    <p className="bc-status" role="status">
      <Loader2 className="bc-spin" aria-hidden />
      {t('publicBooking.outcome.checking')}
    </p>
  );
}

/**
 * The confirmation of a booking (DB-06b), one screen for each state the backend can be in. The state decides what the page says and
 * which single action it offers: «Aggiungi al calendario» for a confirmed booking, the update of an email or a host still to answer,
 * the payment to redo, other dates when there is nothing left to wait for. Only a booking the backend confirmed is called confirmed (D24).
 * Under the first screen come the steps with their real days, and the host if they published a way to reach them. Nothing is drawn
 * for data the booking does not have.
 */
export function ConfirmationScreen({
  view,
  outcome,
  org,
  orgSlug,
  token,
  property,
  clientStatus,
  guestEmail,
  guestFirstName,
  pollingStopped,
  refreshing,
  online,
  onRefresh,
  onPaymentSubmitted,
}: ConfirmationScreenProps) {
  const { t, i18n } = useTranslation();
  const money = useSiteMoney();
  const locale = siteLocale(i18n.language);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const variant = confirmationVariant(view, outcome);
  const home = outcome.propertyName;
  const hostLabel = property?.hostName?.trim() || org.displayName?.trim() || '';
  const hostWord = hostLabel || t('siteConfirm.hostFallback');
  const contactEmail = org.contactEmail?.trim() ?? '';
  const publicPhone = property?.publicPhone?.trim() || null;
  const times = stayTimes(property);
  const guests = outcome.numberOfAdults + outcome.numberOfChildren;
  const days = formatStayRangeLong(outcome.checkInDate, outcome.checkOutDate, locale);
  const deadline = outcome.expiresAt ? formatRomeDateTime(outcome.expiresAt, i18n.language) : '';
  const total = money(outcome.totalPrice, outcome.currency);

  // The state changed (or the page has just opened on one): the title takes the focus, so a screen reader reads the new state.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [view]);

  const manageHref = buildGuestBookingsPath(orgSlug, outcome.bookingCode);
  const otherDatesHref = buildPropertyPageUrl(
    orgSlug,
    { id: outcome.propertyId, slug: outcome.propertySlug },
    { checkIn: outcome.checkInDate, checkOut: outcome.checkOutDate, guests, children: outcome.numberOfChildren },
  );
  const writeHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(t('siteConfirm.mail.subject', { code: outcome.bookingCode }))}`
    : '';
  const writeLabel = hostLabel ? t('publicProperty.host.write', { host: hostLabel }) : t('siteConfirm.action.writeHost');

  const manageLink = (
    <Link to={manageHref} className="bc-link" data-testid="checkout-outcome-manage">
      {t('siteConfirm.action.manage')}
      <ArrowRight aria-hidden />
    </Link>
  );
  const writeAction = (primary: boolean) =>
    writeHref ? (
      <a href={writeHref} className={primary ? CTA : CTA_QUIET} data-testid="checkout-outcome-write">
        <Mail aria-hidden />
        {writeLabel}
      </a>
    ) : null;
  const refreshAction = (primary: boolean) => (
    <button
      type="button"
      className={primary ? CTA : CTA_QUIET}
      aria-disabled={!online || refreshing ? true : undefined}
      onClick={() => {
        if (online && !refreshing) onRefresh();
      }}
      data-testid="checkout-outcome-refresh"
    >
      <RefreshCw aria-hidden className={refreshing ? 'bc-spin' : undefined} />
      {t('publicBooking.outcome.refresh')}
    </button>
  );
  const otherDatesAction = (
    <Link to={otherDatesHref} className={CTA} data-testid="checkout-outcome-other-dates">
      {t('siteConfirm.action.otherDates')}
    </Link>
  );
  const quietWrite = writeHref ? (
    <a href={writeHref} className="bc-link" data-testid="checkout-outcome-write">
      {writeLabel}
    </a>
  ) : null;

  let testId = '';
  let seal: SealKind = 'clock';
  let title = '';
  let lead: ReactNode = null;
  let actions: ReactNode = null;
  const stuck = pollingStopped ? (
    <>
      {' '}
      <span>{t('siteConfirm.stuck')}</span>
    </>
  ) : null;

  switch (view) {
    case 'confirmed': {
      testId = 'checkout-confirmation';
      seal = 'tick';
      title = guestFirstName ? t('siteConfirm.title.confirmedNamed', { name: guestFirstName }) : t('siteConfirm.title.confirmed');
      let payLine = '';
      if (variant === 'later') {
        payLine = t('siteConfirm.lead.later', { date: formatStayDate(outcome.deferredChargeDate ?? '', locale), total });
      } else if (outcome.paymentOption === 'OnSite') {
        payLine = t('siteConfirm.lead.onSite', { total });
      } else if (outcome.paymentOption === 'Immediate') {
        payLine = guestEmail ? t('siteConfirm.lead.paidEmail', { email: guestEmail }) : t('siteConfirm.lead.paid');
      }
      lead = (
        <>
          <span>{t('siteConfirm.lead.stay', { count: guests, home, range: days })}</span>
          {payLine ? (
            <>
              {' '}
              <span>{payLine}</span>
            </>
          ) : null}
        </>
      );
      actions = (
        <>
          <button type="button" className={CTA} onClick={() => setCalendarOpen(true)} data-testid="add-to-calendar">
            <CalendarPlus aria-hidden />
            {t('siteConfirm.action.calendar')}
          </button>
          {manageLink}
        </>
      );
      break;
    }

    case 'processing':
      testId = 'checkout-outcome-processing';
      seal = 'clock';
      title = t('publicBooking.outcome.processingTitle');
      lead = pollingStopped ? t('publicBooking.outcome.processingSlowDescription') : t('publicBooking.outcome.processingDescription');
      actions = (
        <>
          {pollingStopped ? refreshAction(true) : <PollingNote />}
          {manageLink}
        </>
      );
      break;

    case 'failed':
    case 'awaitingPayment':
      testId = view === 'failed' ? 'checkout-outcome-failed' : 'checkout-outcome-awaiting-payment';
      seal = 'card';
      title = view === 'failed' ? t('publicBooking.outcome.failedTitle') : t('publicBooking.outcome.awaitingPaymentTitle');
      if (view === 'failed') {
        lead = deadline ? t('publicBooking.outcome.failedDescription', { time: deadline }) : t('publicBooking.outcome.failedDescriptionNoTime');
      } else {
        lead = deadline
          ? t('publicBooking.outcome.awaitingPaymentDescription', { time: deadline })
          : t('publicBooking.outcome.awaitingPaymentDescriptionNoTime');
      }
      actions = (
        <ResumePayment
          orgSlug={orgSlug}
          bookingId={outcome.bookingId}
          token={token}
          label={view === 'failed' ? t('publicBooking.outcome.retryPayment') : t('publicBooking.outcome.completePayment')}
          online={online}
          onSubmitted={onPaymentSubmitted}
          onUnavailable={onRefresh}
        />
      );
      break;

    case 'awaitingEmail':
      testId = 'checkout-onsite-request-sent';
      seal = 'mail';
      title = t('siteConfirm.title.email');
      lead = (
        <>
          <span>
            {guestEmail ? t('siteConfirm.lead.email', { email: guestEmail, host: hostWord }) : t('siteConfirm.lead.emailNoAddress', { host: hostWord })}
          </span>
          {stuck}
        </>
      );
      actions = (
        <>
          {refreshAction(true)}
          {writeHref ? (
            <a href={writeHref} className="bc-link" data-testid="checkout-outcome-write">
              {t('siteConfirm.action.notArrived')}
            </a>
          ) : (
            manageLink
          )}
        </>
      );
      break;

    case 'awaitingHost':
      testId = 'checkout-outcome-awaiting-host';
      seal = 'clock';
      title = hostLabel ? t('siteConfirm.title.wait', { host: hostLabel }) : t('publicBooking.outcome.awaitingHostTitle');
      lead = (
        <>
          <span>{deadline ? t('publicBooking.onSiteRequest.sentToHost', { date: deadline }) : t('publicBooking.onSiteRequest.sentToHostNoDate')}</span>
          {stuck}
        </>
      );
      actions = (
        <>
          {writeHref ? writeAction(true) : refreshAction(true)}
          {manageLink}
          {pollingStopped && writeHref ? refreshAction(false) : null}
        </>
      );
      break;

    case 'expired': {
      const paid = clientStatus === 'succeeded' || clientStatus === 'processing';
      testId = 'checkout-outcome-expired';
      seal = 'clock';
      title = t('publicBooking.outcome.expiredTitle');
      lead = (
        <>
          <span>
            {outcome.paymentOption === 'OnSite'
              ? t('publicBooking.outcome.expiredRequestDescription')
              : t('publicBooking.outcome.expiredPaymentDescription')}
          </span>
          {paid ? (
            <>
              {' '}
              <span>{t('publicBooking.outcome.latePaymentNote')}</span>
            </>
          ) : null}
        </>
      );
      actions = (
        <>
          {otherDatesAction}
          {quietWrite}
        </>
      );
      break;
    }

    case 'declined':
      testId = 'checkout-outcome-declined';
      seal = 'cross';
      title = t('publicBooking.outcome.declinedTitle');
      lead = t('publicBooking.outcome.declinedDescription');
      actions = (
        <>
          {otherDatesAction}
          {quietWrite}
        </>
      );
      break;

    case 'datesUnavailable':
      testId = 'checkout-outcome-dates-unavailable';
      seal = 'cross';
      title = t('publicBooking.outcome.datesUnavailableTitle');
      lead = t('publicBooking.outcome.datesUnavailableDescription');
      actions = (
        <>
          {otherDatesAction}
          {quietWrite}
        </>
      );
      break;

    case 'cancelled':
      testId = 'checkout-outcome-cancelled';
      seal = 'cross';
      title = t('publicBooking.outcome.cancelledTitle');
      lead = t('publicBooking.outcome.cancelledDescription');
      actions = (
        <>
          {otherDatesAction}
          {quietWrite}
        </>
      );
      break;
  }

  const steps = buildNextSteps({ variant, outcome, today: todayInRome() });
  const hostWrite = writeHref ? (
    <a href={writeHref} className={HOST_ACTION_CLASS} data-testid="property-host-write">
      {writeLabel}
    </a>
  ) : null;
  const showHost = steps.length > 0 && hostLabel !== '' && (hostWrite !== null || publicPhone !== null);

  const calendarStay: CalendarStay = {
    code: outcome.bookingCode,
    title: t('siteConfirm.calendar.eventTitle', { home }),
    place: calendarPlace(property, i18n.language),
    notes: [
      home,
      t('siteConfirm.calendar.code', { code: outcome.bookingCode }),
      times.arrivalFrom ? t('siteConfirm.calendar.arriveFrom', { time: times.arrivalFrom }) : '',
      times.departureBy ? t('siteConfirm.calendar.leaveBy', { time: times.departureBy }) : '',
      hostLabel && publicPhone ? t('siteConfirm.calendar.contact', { host: hostLabel, phone: publicPhone }) : '',
    ],
    checkIn: outcome.checkInDate,
    checkOut: outcome.checkOutDate,
  };

  return (
    <div className="bc" data-testid={testId} data-variant={variant}>
      {!online ? (
        <p className="bc-offline" role="status" data-testid="checkout-outcome-offline">
          <WifiOff aria-hidden />
          <span>{t('siteConfirm.offline')}</span>
        </p>
      ) : null}

      <ConfirmationHero
        seal={seal}
        title={title}
        titleRef={titleRef}
        lead={lead}
        actions={actions}
        aside={<StayTicket outcome={outcome} property={property} view={view} variant={variant} />}
      />

      <NextSteps
        steps={steps}
        outcome={outcome}
        hostLabel={hostLabel}
        guestEmail={guestEmail}
        arrivalFrom={times.arrivalFrom}
        departureBy={times.departureBy}
      />

      {showHost ? (
        <div className="bc-sec bc-sec--end">
          <div className="bc-wrap">
            <HostCard name={hostLabel} phone={publicPhone} writeAction={hostWrite} />
          </div>
        </div>
      ) : null}

      {variant === 'ok' || variant === 'later' ? (
        <AddToCalendarSheet
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
          stay={calendarStay}
          fileName={t('siteConfirm.calendar.fileName', { code: outcome.bookingCode })}
          home={home}
          days={days}
        />
      ) : null}
    </div>
  );
}
