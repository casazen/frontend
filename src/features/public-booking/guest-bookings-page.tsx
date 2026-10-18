import { useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CalendarCheck, Clock, Loader2, Mail, RefreshCw, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { useSendGuestCheckInLink } from '@/queries/use-public-booking';
import { isGuestSessionRefused, useGuestBooking, useGuestSession } from '@/queries/use-guest-session';
import { getProblemCode, getProblemMessage, getRetryAfterSeconds, isTransientRequestError } from '@/lib/api-errors';
import { formatBookingCode, isValidBookingCode } from '@/lib/booking-code';
import { formatRomeDateTime, formatStayDate, nightsBetween } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { GuestBookingDetails, GuestBookingLookupPayload, GuestBookingStatus, PublicOrgDto } from '@/types';
import { GuestAreaSlot } from './guest-area-slot';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** 404 of the guest area: nothing matches code + email on this site (the same answer whatever does not match). */
const NOT_FOUND_CODE = 'guest_booking_not_found';

/** Nothing matches: an empty state, not an error. */
function isNotFound(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 404 &&
    getProblemCode(error.response.data) === NOT_FOUND_CODE
  );
}

// The messages are i18n keys: FormFieldError translates them when rendering.
const lookupSchema = z.object({
  bookingCode: z
    .string()
    .trim()
    .min(1, 'publicBooking.guestBookings.codeRequired')
    .refine(isValidBookingCode, 'publicBooking.guestBookings.codeInvalid'),
  email: z
    .string()
    .trim()
    .min(1, 'publicBooking.guestBookings.emailRequired')
    .email('publicBooking.emailValidation'),
});

type LookupForm = z.infer<typeof lookupSchema>;

const STATUS_LABEL_KEYS: Record<GuestBookingStatus, string> = {
  Confirmed: 'publicBooking.guestBookings.status.Confirmed',
  AwaitingPayment: 'publicBooking.guestBookings.status.AwaitingPayment',
  PaymentProcessing: 'publicBooking.guestBookings.status.PaymentProcessing',
  PaymentFailed: 'publicBooking.guestBookings.status.PaymentFailed',
  AwaitingGuestEmail: 'publicBooking.guestBookings.status.AwaitingGuestEmail',
  AwaitingHostApproval: 'publicBooking.guestBookings.status.AwaitingHostApproval',
  Expired: 'publicBooking.guestBookings.status.Expired',
  Declined: 'publicBooking.guestBookings.status.Declined',
  DatesUnavailable: 'publicBooking.guestBookings.status.DatesUnavailable',
  Cancelled: 'publicBooking.guestBookings.status.Cancelled',
  StayInProgress: 'publicBooking.guestBookings.status.StayInProgress',
  StayCompleted: 'publicBooking.guestBookings.status.StayCompleted',
};

/** Description of a state; `[withTime, withoutTime]` for the states that wait until `expiresAt`. */
const STATUS_DESCRIPTION_KEYS: Record<GuestBookingStatus, string | [string, string]> = {
  Confirmed: 'publicBooking.guestBookings.statusDescription.Confirmed',
  AwaitingPayment: [
    'publicBooking.guestBookings.statusDescription.AwaitingPayment',
    'publicBooking.guestBookings.statusDescription.AwaitingPaymentNoTime',
  ],
  PaymentProcessing: 'publicBooking.guestBookings.statusDescription.PaymentProcessing',
  PaymentFailed: [
    'publicBooking.guestBookings.statusDescription.PaymentFailed',
    'publicBooking.guestBookings.statusDescription.PaymentFailedNoTime',
  ],
  AwaitingGuestEmail: [
    'publicBooking.guestBookings.statusDescription.AwaitingGuestEmail',
    'publicBooking.guestBookings.statusDescription.AwaitingGuestEmailNoTime',
  ],
  AwaitingHostApproval: [
    'publicBooking.guestBookings.statusDescription.AwaitingHostApproval',
    'publicBooking.guestBookings.statusDescription.AwaitingHostApprovalNoTime',
  ],
  Expired: 'publicBooking.guestBookings.statusDescription.Expired',
  Declined: 'publicBooking.guestBookings.statusDescription.Declined',
  DatesUnavailable: 'publicBooking.guestBookings.statusDescription.DatesUnavailable',
  Cancelled: 'publicBooking.guestBookings.statusDescription.Cancelled',
  StayInProgress: 'publicBooking.guestBookings.statusDescription.StayInProgress',
  StayCompleted: 'publicBooking.guestBookings.statusDescription.StayCompleted',
};

const POSITIVE_STATUSES: GuestBookingStatus[] = ['Confirmed', 'StayInProgress', 'StayCompleted'];
const WAITING_STATUSES: GuestBookingStatus[] = [
  'AwaitingPayment',
  'PaymentProcessing',
  'PaymentFailed',
  'AwaitingGuestEmail',
  'AwaitingHostApproval',
];

/** The message of a failed call of the guest area: the minutes to wait after a 429 when the answer says, else the generic one. */
function useFailureMessage() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    const seconds = getRetryAfterSeconds(error);
    if (seconds !== undefined) {
      return t('publicBooking.guestBookings.rateLimited', { count: Math.max(1, Math.ceil(seconds / 60)) });
    }
    return getProblemMessage(error, t) ?? t('publicBooking.guestBookings.loadError');
  };
}

/**
 * "Le mie prenotazioni" of a booking site, `/book/:orgSlug/my-bookings?code=…` (BK-11, A3-10, DB-06c): the guest types the
 * booking code of the confirmation email (filled in from the link of the email or of the outcome page) and the email they
 * booked with, once, and opens a **session** (DB-06a): a signed token with a short life, kept in `sessionStorage` of the tab for
 * this site, with which the booking is read. "Esci" forgets it. The email stays in memory only. Nothing about the booking is shown
 * until the backend has matched both; "not found" is an empty state, distinct from an error; a session that has ended asks for the
 * email again, with the code already filled in. The features of the guest area (messages…) hook in at {@link GuestAreaSlot}.
 */
export function GuestBookingsPage() {
  const { t } = useTranslation();
  const failureMessage = useFailureMessage();
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const [searchParams] = useSearchParams();
  const siteSlug = org?.slug || orgSlug;
  const { session, openSession, closeSession } = useGuestSession(siteSlug);
  // What the guest typed to open the session. The email is only here, in memory: the online check-in link asks for it again.
  const [credentials, setCredentials] = useState<GuestBookingLookupPayload | null>(null);

  // The link of an email names its booking: when it is not the one of the session, the form comes first.
  const linkedCode = formatBookingCode(searchParams.get('code'));
  const activeSession = session && (linkedCode === null || linkedCode === session.bookingCode) ? session : null;
  const booking = useGuestBooking(siteSlug, activeSession);

  const sessionEnded = isGuestSessionRefused(booking.error);
  const bookingNotFound = isNotFound(booking.error);
  const showBooking = activeSession !== null && booking.data !== undefined && !sessionEnded && !bookingNotFound;
  const showLoading = activeSession !== null && !showBooking && booking.isPending;
  const showBookingError = activeSession !== null && !showBooking && booking.isError && !sessionEnded && !bookingNotFound;
  const showForm = !showBooking && !showLoading && !showBookingError;

  const openNotFound = isNotFound(openSession.error);
  const notFound = openNotFound || (showForm && bookingNotFound);

  const submit = (payload: GuestBookingLookupPayload) => {
    setCredentials(payload);
    openSession.mutate(payload);
  };

  const signOut = () => {
    setCredentials(null);
    closeSession();
  };

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-3xl font-bold">{t('publicBooking.myBookingsTitle')}</h2>
        {!showBooking && <p className="text-muted-foreground">{t('publicBooking.myBookingsDescription')}</p>}
      </section>

      {showBooking && activeSession && booking.data && (
        <div className="max-w-2xl space-y-4">
          <GuestBookingCard booking={booking.data} siteSlug={siteSlug} knownEmail={credentials?.email ?? null} />
          <GuestAreaSlot session={activeSession} booking={booking.data} siteSlug={siteSlug} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={signOut} data-testid="guest-bookings-search-another">
              {t('publicBooking.guestBookings.searchAnother')}
            </Button>
            <Button variant="ghost" onClick={signOut} data-testid="guest-bookings-sign-out">
              {t('publicBooking.guestBookings.signOut')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('publicBooking.guestBookings.sharedDevice')}</p>
        </div>
      )}

      {showLoading && (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
          data-testid="guest-bookings-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('publicBooking.guestBookings.loadingBooking')}
        </p>
      )}

      {showBookingError && (
        <div className="max-w-md space-y-4">
          <div
            className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
            role="alert"
            data-testid="guest-bookings-error"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="space-y-2">
              <p className="text-sm text-destructive">{failureMessage(booking.error)}</p>
              <div className="flex flex-wrap gap-2">
                {isTransientRequestError(booking.error) && (
                  <Button variant="outline" size="sm" onClick={() => void booking.refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('publicBooking.guestBookings.retry')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={signOut}>
                  {t('publicBooking.guestBookings.signOut')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="max-w-md space-y-4">
          <GuestAccessForm
            initialCode={linkedCode ?? session?.bookingCode ?? ''}
            pending={openSession.isPending}
            onSubmit={(data) =>
              submit({
                orgSlug: siteSlug,
                bookingCode: formatBookingCode(data.bookingCode) ?? data.bookingCode,
                email: data.email,
              })
            }
          />

          {sessionEnded && !openSession.isError && (
            <div
              className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
              role="status"
              data-testid="guest-bookings-session-expired"
            >
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
              <div>
                <p className="font-medium text-amber-900">{t('publicBooking.guestBookings.sessionExpiredTitle')}</p>
                <p className="text-sm text-amber-800">{t('publicBooking.guestBookings.sessionExpiredDescription')}</p>
              </div>
            </div>
          )}

          {notFound && (
            <div
              className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
              role="status"
              data-testid="guest-bookings-not-found"
            >
              <SearchX className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
              <div>
                <p className="font-medium text-amber-900">{t('publicBooking.guestBookings.notFoundTitle')}</p>
                <p className="text-sm text-amber-800">{t('publicBooking.guestBookings.notFoundDescription')}</p>
              </div>
            </div>
          )}

          {openSession.isError && !openNotFound && (
            <div
              className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
              role="alert"
              data-testid="guest-bookings-error"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="space-y-2">
                <p className="text-sm text-destructive">{failureMessage(openSession.error)}</p>
                {credentials && isTransientRequestError(openSession.error) && (
                  <Button variant="outline" size="sm" onClick={() => submit(credentials)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('publicBooking.guestBookings.retry')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The form that opens the session: booking code and email. It is mounted only while it is shown, so the email is always empty when
 * it comes back (after "Esci" or when a session has ended) and the code starts as the one of the link or of the ended session.
 */
function GuestAccessForm({
  initialCode,
  pending,
  onSubmit,
}: {
  initialCode: string;
  pending: boolean;
  onSubmit: (data: LookupForm) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LookupForm>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { bookingCode: initialCode, email: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate data-testid="guest-bookings-form">
      <div className="space-y-2">
        <Label htmlFor="guest-booking-code">{t('publicBooking.guestBookings.codeLabel')}</Label>
        <Input
          id="guest-booking-code"
          placeholder={t('publicBooking.guestBookings.codePlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono uppercase tracking-wider"
          disabled={pending}
          aria-invalid={errors.bookingCode ? true : undefined}
          aria-describedby="guest-booking-code-hint"
          {...register('bookingCode')}
        />
        <p id="guest-booking-code-hint" className="text-xs text-muted-foreground">
          {t('publicBooking.guestBookings.codeHint')}
        </p>
        <FormFieldError error={errors.bookingCode} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-booking-email">{t('publicBooking.guestBookings.emailLabel')}</Label>
        <Input
          id="guest-booking-email"
          type="email"
          autoComplete="email"
          placeholder={t('publicBooking.emailPlaceholder')}
          disabled={pending}
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
        <FormFieldError error={errors.email} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {pending ? t('publicBooking.guestBookings.searching') : t('publicBooking.guestBookings.submit')}
      </Button>
    </form>
  );
}

function GuestBookingCard({
  booking,
  siteSlug,
  knownEmail,
}: {
  booking: GuestBookingDetails;
  siteSlug: string;
  knownEmail: string | null;
}) {
  const { t, i18n } = useTranslation();
  const nights = nightsBetween(booking.checkInDate, booking.checkOutDate);
  const guests = booking.numberOfAdults + booking.numberOfChildren;
  const statusTone = POSITIVE_STATUSES.includes(booking.status)
    ? 'bg-green-100 text-green-800'
    : WAITING_STATUSES.includes(booking.status)
      ? 'bg-amber-100 text-amber-800'
      : 'bg-muted text-muted-foreground';
  const descriptionKeys = STATUS_DESCRIPTION_KEYS[booking.status];
  const deadline = booking.expiresAt ? formatRomeDateTime(booking.expiresAt, i18n.language) : '';
  const description = Array.isArray(descriptionKeys)
    ? deadline
      ? t(descriptionKeys[0], { time: deadline })
      : t(descriptionKeys[1])
    : t(descriptionKeys);

  return (
    <article className="space-y-6 rounded-lg border p-6" data-testid="guest-booking-result">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{booking.propertyName}</h3>
          {booking.propertyCity && <p className="text-sm text-muted-foreground">{booking.propertyCity}</p>}
        </div>
        <span
          className={`inline-flex items-center self-start rounded-full px-3 py-1 text-sm font-medium ${statusTone}`}
          data-testid="guest-booking-status"
        >
          {t(STATUS_LABEL_KEYS[booking.status])}
        </span>
      </header>

      <p className="text-sm">{description}</p>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{t('publicBooking.guestBookings.codeLabel')}</p>
        <p className="font-mono text-lg font-semibold tracking-wider">{booking.bookingCode}</p>
      </div>

      <Section title={t('publicBooking.guestBookings.stayTitle')}>
        <p className="text-sm">
          {t('publicBooking.checkoutDates', {
            checkIn: formatStayDate(booking.checkInDate, i18n.language),
            checkOut: formatStayDate(booking.checkOutDate, i18n.language),
            count: nights,
          })}
        </p>
        <p className="text-sm text-muted-foreground">{t('publicBooking.guestBookings.guestsCount', { count: guests })}</p>
      </Section>

      <Section title={t('publicBooking.guestBookings.amountsTitle')}>
        <dl className="space-y-1 text-sm" data-testid="guest-booking-amounts">
          <AmountRow label={t('publicBooking.guestBookings.lodging')} amount={booking.lodging} currency={booking.currency} />
          {booking.cleaningFee > 0 && (
            <AmountRow label={t('publicBooking.guestBookings.cleaning')} amount={booking.cleaningFee} currency={booking.currency} />
          )}
          {booking.touristTax > 0 && (
            <AmountRow label={t('publicBooking.guestBookings.touristTax')} amount={booking.touristTax} currency={booking.currency} />
          )}
          <AmountRow label={t('publicBooking.guestBookings.total')} amount={booking.totalPrice} currency={booking.currency} strong />
          {booking.paidAmount > 0 && (
            <AmountRow label={t('publicBooking.guestBookings.paid')} amount={booking.paidAmount} currency={booking.currency} />
          )}
          {booking.refundedAmount > 0 && (
            <AmountRow label={t('publicBooking.guestBookings.refunded')} amount={booking.refundedAmount} currency={booking.currency} />
          )}
        </dl>
        <p className="text-sm text-muted-foreground">
          {booking.paymentOption === 'OnSite'
            ? t('publicBooking.guestBookings.paymentOnSite')
            : booking.paymentOption === 'OnCancellationDeadline'
              ? booking.deferredChargeDate
                ? t('publicBooking.guestBookings.paymentDeferredOn', {
                    date: formatStayDate(booking.deferredChargeDate, i18n.language),
                  })
                : t('publicBooking.guestBookings.paymentDeferred')
              : t('publicBooking.guestBookings.paymentImmediate')}
        </p>
      </Section>

      {booking.checkIn.status !== 'NotApplicable' && (
        <Section title={t('publicBooking.guestBookings.checkIn.title')}>
          <CheckInAccess booking={booking} siteSlug={siteSlug} knownEmail={knownEmail} />
        </Section>
      )}

      <Section title={t('publicBooking.guestBookings.hostTitle')}>
        <HostContact host={booking.host} />
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-4">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function AmountRow({
  label,
  amount,
  currency,
  strong = false,
}: {
  label: string;
  amount: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{formatCurrency(amount, currency)}</dd>
    </div>
  );
}

/**
 * The online check-in (CO-02): the link is never shown here, only emailed to the address of the booking, so the button
 * asks the backend to send it (again). That call proves the booking with code + email, so when the session was restored
 * from the tab (the email is never kept) the guest writes the email again.
 */
function CheckInAccess({
  booking,
  siteSlug,
  knownEmail,
}: {
  booking: GuestBookingDetails;
  siteSlug: string;
  knownEmail: string | null;
}) {
  const { t, i18n } = useTranslation();
  const sendLink = useSendGuestCheckInLink();
  const [typedEmail, setTypedEmail] = useState('');
  const { status, opensOn, linkSentAt } = booking.checkIn;
  const email = knownEmail ?? typedEmail.trim();

  if (status === 'Completed') {
    return (
      <p className="flex items-center gap-2 text-sm" data-testid="guest-booking-check-in">
        <CalendarCheck className="h-4 w-4 text-green-700" />
        {t('publicBooking.guestBookings.checkIn.completed')}
      </p>
    );
  }

  if (status === 'NotYetOpen') {
    return (
      <p className="text-sm" data-testid="guest-booking-check-in">
        {opensOn
          ? t('publicBooking.guestBookings.checkIn.notYetOpen', { date: formatStayDate(opensOn, i18n.language) })
          : t('publicBooking.guestBookings.checkIn.open')}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="guest-booking-check-in">
      <p className="text-sm">
        {linkSentAt
          ? t('publicBooking.guestBookings.checkIn.openSent', { time: formatRomeDateTime(linkSentAt, i18n.language) })
          : t('publicBooking.guestBookings.checkIn.open')}
      </p>
      {sendLink.isSuccess ? (
        <p className="flex items-center gap-2 text-sm text-green-800" role="status" data-testid="guest-booking-check-in-sent">
          <Mail className="h-4 w-4" />
          {t('publicBooking.guestBookings.checkIn.sent')}
        </p>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            sendLink.mutate({ orgSlug: siteSlug, bookingCode: booking.bookingCode, email });
          }}
        >
          {knownEmail === null && (
            <div className="space-y-2">
              <Label htmlFor="guest-check-in-email">{t('publicBooking.guestBookings.emailLabel')}</Label>
              <Input
                id="guest-check-in-email"
                type="email"
                autoComplete="email"
                placeholder={t('publicBooking.emailPlaceholder')}
                value={typedEmail}
                onChange={(event) => setTypedEmail(event.target.value)}
                aria-describedby="guest-check-in-email-hint"
              />
              <p id="guest-check-in-email-hint" className="text-xs text-muted-foreground">
                {t('publicBooking.guestBookings.checkIn.emailNeeded')}
              </p>
            </div>
          )}
          <Button type="submit" variant="outline" size="sm" disabled={sendLink.isPending || email === ''}>
            {sendLink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sendLink.isPending
              ? t('publicBooking.guestBookings.checkIn.sending')
              : linkSentAt
                ? t('publicBooking.guestBookings.checkIn.sendAgain')
                : t('publicBooking.guestBookings.checkIn.send')}
          </Button>
        </form>
      )}
      {sendLink.isError && (
        <p className="text-sm text-destructive" role="alert" data-testid="guest-booking-check-in-error">
          {getProblemMessage(sendLink.error, t) ?? t('publicBooking.guestBookings.checkIn.sendError')}
        </p>
      )}
    </div>
  );
}

function HostContact({ host }: { host: GuestBookingDetails['host'] }) {
  const { t } = useTranslation();
  if (!host.email) {
    return <p className="text-sm">{t('publicBooking.guestBookings.hostContactDirectly')}</p>;
  }

  return (
    <p className="text-sm" data-testid="guest-booking-host">
      {host.name
        ? t('publicBooking.guestBookings.hostContact', { name: host.name })
        : t('publicBooking.guestBookings.hostContactNoName')}{' '}
      <a href={`mailto:${host.email}`} className="font-medium underline">
        {host.email}
      </a>
    </p>
  );
}
