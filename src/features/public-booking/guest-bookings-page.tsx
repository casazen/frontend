import { useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CalendarCheck, Loader2, Mail, RefreshCw, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { useGuestBookingLookup, useSendGuestCheckInLink } from '@/queries/use-public-booking';
import { getProblemCode, getProblemMessage, isTransientRequestError } from '@/lib/api-errors';
import { formatBookingCode, isValidBookingCode } from '@/lib/booking-code';
import { formatRomeDateTime, formatStayDate, nightsBetween } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { GuestBookingDetails, GuestBookingLookupPayload, GuestBookingStatus, PublicOrgDto } from '@/types';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** 404 of the lookup: nothing matches code + email on this site (the same answer whatever does not match). */
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

/**
 * "Le mie prenotazioni" of a booking site, `/book/:orgSlug/my-bookings?code=…` (BK-11, A3-10): the guest types the
 * booking code of the confirmation email (filled in from the link of the email or of the outcome page) and the email they
 * booked with. Nothing about the booking is shown until the backend has matched both; "not found" is an empty state,
 * distinct from an error.
 */
export function GuestBookingsPage() {
  const { t } = useTranslation();
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const [searchParams] = useSearchParams();
  const lookup = useGuestBookingLookup();
  const [credentials, setCredentials] = useState<GuestBookingLookupPayload | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LookupForm>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { bookingCode: formatBookingCode(searchParams.get('code')) ?? '', email: '' },
  });

  const search = (payload: GuestBookingLookupPayload) => {
    setCredentials(payload);
    lookup.mutate(payload);
  };

  const onSubmit = (data: LookupForm) =>
    search({
      orgSlug: org?.slug || orgSlug,
      bookingCode: formatBookingCode(data.bookingCode) ?? data.bookingCode,
      email: data.email,
    });

  const searchAnother = () => {
    lookup.reset();
    setCredentials(null);
  };

  const notFound = isNotFound(lookup.error);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-3xl font-bold">{t('publicBooking.myBookingsTitle')}</h2>
        {!lookup.isSuccess && <p className="text-muted-foreground">{t('publicBooking.myBookingsDescription')}</p>}
      </section>

      {lookup.isSuccess && credentials ? (
        <div className="max-w-2xl space-y-4">
          <GuestBookingCard booking={lookup.data} credentials={credentials} />
          <Button variant="outline" onClick={searchAnother} data-testid="guest-bookings-search-another">
            {t('publicBooking.guestBookings.searchAnother')}
          </Button>
        </div>
      ) : (
        <div className="max-w-md space-y-4">
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
                disabled={lookup.isPending}
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
                disabled={lookup.isPending}
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
              <FormFieldError error={errors.email} />
            </div>
            <Button type="submit" disabled={lookup.isPending} className="w-full">
              {lookup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {lookup.isPending ? t('publicBooking.guestBookings.searching') : t('publicBooking.guestBookings.submit')}
            </Button>
          </form>

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

          {lookup.isError && !notFound && (
            <div
              className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
              role="alert"
              data-testid="guest-bookings-error"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  {getProblemMessage(lookup.error, t) ?? t('publicBooking.guestBookings.loadError')}
                </p>
                {credentials && isTransientRequestError(lookup.error) && (
                  <Button variant="outline" size="sm" onClick={() => search(credentials)}>
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

function GuestBookingCard({
  booking,
  credentials,
}: {
  booking: GuestBookingDetails;
  credentials: GuestBookingLookupPayload;
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
          <CheckInAccess booking={booking} credentials={credentials} />
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
 * asks the backend to send it (again).
 */
function CheckInAccess({
  booking,
  credentials,
}: {
  booking: GuestBookingDetails;
  credentials: GuestBookingLookupPayload;
}) {
  const { t, i18n } = useTranslation();
  const sendLink = useSendGuestCheckInLink();
  const { status, opensOn, linkSentAt } = booking.checkIn;

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
        <Button
          variant="outline"
          size="sm"
          disabled={sendLink.isPending}
          onClick={() => sendLink.mutate(credentials)}
        >
          {sendLink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {sendLink.isPending
            ? t('publicBooking.guestBookings.checkIn.sending')
            : linkSentAt
              ? t('publicBooking.guestBookings.checkIn.sendAgain')
              : t('publicBooking.guestBookings.checkIn.send')}
        </Button>
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
