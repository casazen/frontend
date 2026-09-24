import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock, Loader2, MailCheck, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckoutOutcome, useResumeCheckoutPayment } from '@/queries/use-public-booking';
import { getProblemMessage, isTransientRequestError } from '@/lib/api-errors';
import { buildCheckoutOutcomePath, buildOrgBookingPath, buildPropertyPageUrl } from '@/lib/booking-url';
import { clearPendingCheckout } from '@/lib/pending-checkout';
import { formatRomeDateTime, formatStayDate, nightsBetween } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import {
  MAX_POLL_ATTEMPTS,
  clientStatusFromRedirect,
  isFinalView,
  isIntermediateView,
  nextPollDelay,
  resolveOutcomeView,
  type ClientPaymentStatus,
  type OutcomeView,
} from '@/features/public-booking/checkout-outcome';
import type { CheckoutOutcome, PublicOrgDto } from '@/types';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** What the checkout hands to this page when it navigates here (never in the URL). */
export interface CheckoutOutcomeLocationState {
  /** Result of the guest's own payment attempt in the page (`confirmPayment` / `confirmSetup`). */
  clientStatus?: ClientPaymentStatus;
  /** "Pay at the property": the address the confirmation email was sent to, only to say where to look. */
  guestEmail?: string;
}

/** Parameters Stripe appends to the `return_url` of a redirect method. */
const STRIPE_RETURN_PARAMS = [
  'payment_intent',
  'payment_intent_client_secret',
  'setup_intent',
  'setup_intent_client_secret',
  'redirect_status',
] as const;

function readLocationState(state: unknown): CheckoutOutcomeLocationState {
  if (typeof state !== 'object' || state === null) return {};
  const value = state as Record<string, unknown>;
  const clientStatus =
    value.clientStatus === 'succeeded' || value.clientStatus === 'processing' || value.clientStatus === 'failed'
      ? value.clientStatus
      : undefined;
  return {
    clientStatus,
    guestEmail: typeof value.guestEmail === 'string' ? value.guestEmail : undefined,
  };
}

/**
 * Outcome page of a public checkout, `/book/:orgSlug/booking/:bookingId?token=…` (BK-07, A3-15). It shows the real state
 * of the booking from the backend, never "Prenotazione confermata" before the confirmation: payment being confirmed (e.g.
 * SEPA), failed with a retry on the same hold, "pay at the property" request waiting for the email or the host, expired.
 * It is also the Stripe `return_url` of the redirect methods: the guest comes back to their booking, not to an empty
 * checkout whose new booking their own hold would block.
 */
export function CheckoutOutcomePage() {
  const { t } = useTranslation();
  const { orgSlug = '', bookingId = '' } = useParams<{ orgSlug: string; bookingId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { org } = useOutletContext<PublicBookingContext>();
  const token = searchParams.get('token') ?? '';
  const locationState = readLocationState(location.state);
  const redirectStatus = clientStatusFromRedirect(searchParams.get('redirect_status'));
  const initialClientStatus = redirectStatus ?? locationState.clientStatus ?? null;
  const hasStripeParams = STRIPE_RETURN_PARAMS.some((key) => searchParams.has(key));

  // Back from a redirect method: keep what Stripe said in the history state and drop its parameters (the client secret
  // among them) from the address bar, so a reload or a shared link does not carry them.
  useEffect(() => {
    if (!hasStripeParams || !bookingId || !token) return;
    const state: CheckoutOutcomeLocationState = { ...locationState, clientStatus: initialClientStatus ?? undefined };
    navigate(buildCheckoutOutcomePath(orgSlug, bookingId, token), { replace: true, state });
    // Runs once per Stripe return; the replaced URL has no Stripe parameter left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStripeParams]);

  if (!bookingId || !token) {
    return (
      <OutcomeLayout testId="checkout-outcome-invalid" icon={<AlertCircle className="h-12 w-12 text-destructive" />}>
        <p role="alert">{t('publicBooking.outcome.linkIncomplete')}</p>
        <BackToProperties orgSlug={orgSlug} />
      </OutcomeLayout>
    );
  }

  return (
    <OutcomeContent
      key={`${bookingId}:${token}`}
      org={org}
      orgSlug={orgSlug}
      bookingId={bookingId}
      token={token}
      initialClientStatus={initialClientStatus}
      guestEmail={locationState.guestEmail}
    />
  );
}

function OutcomeContent({
  org,
  orgSlug,
  bookingId,
  token,
  initialClientStatus,
  guestEmail,
}: {
  org: PublicOrgDto;
  orgSlug: string;
  bookingId: string;
  token: string;
  initialClientStatus: ClientPaymentStatus | null;
  guestEmail?: string;
}) {
  const { t } = useTranslation();
  const outcome = useCheckoutOutcome(bookingId, token);
  const [clientStatus, setClientStatus] = useState(initialClientStatus);
  const [attempt, setAttempt] = useState(0);
  const { data, isFetching, refetch } = outcome;
  const view: OutcomeView | null = data ? resolveOutcomeView(data.state, clientStatus) : null;
  const intermediate = view !== null && isIntermediateView(view, clientStatus);
  const pollingStopped = intermediate && attempt >= MAX_POLL_ATTEMPTS;

  // Polling with backoff while someone else still has to act (Stripe and its webhook, the guest's email, the host).
  useEffect(() => {
    if (!intermediate || pollingStopped || isFetching) return undefined;
    const timer = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      void refetch();
    }, nextPollDelay(attempt));
    return () => window.clearTimeout(timer);
  }, [intermediate, pollingStopped, isFetching, attempt, refetch]);

  useEffect(() => {
    if (view !== null && isFinalView(view)) clearPendingCheckout(bookingId);
  }, [view, bookingId]);

  const refresh = () => {
    setAttempt(0);
    void refetch();
  };

  const onPaymentSubmitted = (status: ClientPaymentStatus) => {
    setClientStatus(status);
    refresh();
  };

  if (!data || view === null) {
    if (outcome.isError) {
      const transient = isTransientRequestError(outcome.error);
      return (
        <OutcomeLayout testId="checkout-outcome-error" icon={<AlertCircle className="h-12 w-12 text-destructive" />}>
          <p role="alert">{getProblemMessage(outcome.error, t) ?? t('publicBooking.outcome.loadError')}</p>
          {transient && (
            <Button variant="outline" className="w-full" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('publicBooking.outcome.retryLoad')}
            </Button>
          )}
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 py-12" data-testid="checkout-outcome-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('publicBooking.outcome.loading')}</p>
      </div>
    );
  }

  return (
    <OutcomeScreen
      view={view}
      outcome={data}
      org={org}
      orgSlug={orgSlug}
      token={token}
      clientStatus={clientStatus}
      guestEmail={guestEmail}
      pollingStopped={pollingStopped}
      refreshing={isFetching}
      onRefresh={refresh}
      onPaymentSubmitted={onPaymentSubmitted}
    />
  );
}

function OutcomeScreen({
  view,
  outcome,
  org,
  orgSlug,
  token,
  clientStatus,
  guestEmail,
  pollingStopped,
  refreshing,
  onRefresh,
  onPaymentSubmitted,
}: {
  view: OutcomeView;
  outcome: CheckoutOutcome;
  org: PublicOrgDto;
  orgSlug: string;
  token: string;
  clientStatus: ClientPaymentStatus | null;
  guestEmail?: string;
  pollingStopped: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onPaymentSubmitted: (status: ClientPaymentStatus) => void;
}) {
  const { t, i18n } = useTranslation();
  const deadline = outcome.expiresAt ? formatRomeDateTime(outcome.expiresAt, i18n.language) : '';
  const refreshButton = pollingStopped && (
    <Button variant="outline" className="w-full" onClick={onRefresh} disabled={refreshing}>
      <RefreshCw className="mr-2 h-4 w-4" />
      {t('publicBooking.outcome.refresh')}
    </Button>
  );
  const bookAgainUrl = buildPropertyPageUrl(
    orgSlug,
    { id: outcome.propertyId, slug: outcome.propertySlug },
    {
      checkIn: outcome.checkInDate,
      checkOut: outcome.checkOutDate,
      guests: outcome.numberOfAdults + outcome.numberOfChildren,
      children: outcome.numberOfChildren,
    },
  );
  const bookAgain = (
    <Button asChild className="w-full">
      <Link to={bookAgainUrl}>{t('publicBooking.outcome.bookAgain')}</Link>
    </Button>
  );
  const summary = <StaySummary outcome={outcome} />;

  switch (view) {
    case 'confirmed':
      return (
        <OutcomeLayout testId="checkout-confirmation" icon={<CheckCircle2 className="h-12 w-12 text-green-600" />}>
          <Heading title={t('publicBooking.bookingConfirmed')}>
            {t('publicBooking.bookingConfirmedDescription', { orgName: org.displayName })}
          </Heading>
          {summary}
          <InfoCard label={t('publicBooking.paymentMethod')}>
            {outcome.paymentOption === 'OnCancellationDeadline' && outcome.deferredChargeDate
              ? t('publicBooking.outcome.deferredCharge', {
                  date: formatStayDate(outcome.deferredChargeDate, i18n.language),
                })
              : outcome.paymentOption === 'OnSite'
                ? t('publicBooking.outcome.payAtProperty')
                : t('publicBooking.paidOnline')}
          </InfoCard>
          <BookingReference bookingId={outcome.bookingId} />
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );

    case 'processing':
      return (
        <OutcomeLayout testId="checkout-outcome-processing" icon={<Clock className="h-12 w-12 text-amber-600" />}>
          <Heading title={t('publicBooking.outcome.processingTitle')}>
            {pollingStopped
              ? t('publicBooking.outcome.processingSlowDescription')
              : t('publicBooking.outcome.processingDescription')}
          </Heading>
          {!pollingStopped && <Polling />}
          {summary}
          <BookingReference bookingId={outcome.bookingId} />
          {refreshButton}
        </OutcomeLayout>
      );

    case 'failed':
    case 'awaitingPayment':
      return (
        <OutcomeLayout testId={`checkout-outcome-${view === 'failed' ? 'failed' : 'awaiting-payment'}`} icon={
          <AlertCircle className={`h-12 w-12 ${view === 'failed' ? 'text-destructive' : 'text-amber-600'}`} />
        }>
          <Heading
            title={
              view === 'failed'
                ? t('publicBooking.outcome.failedTitle')
                : t('publicBooking.outcome.awaitingPaymentTitle')
            }
          >
            {view === 'failed'
              ? deadline
                ? t('publicBooking.outcome.failedDescription', { time: deadline })
                : t('publicBooking.outcome.failedDescriptionNoTime')
              : deadline
                ? t('publicBooking.outcome.awaitingPaymentDescription', { time: deadline })
                : t('publicBooking.outcome.awaitingPaymentDescriptionNoTime')}
          </Heading>
          {summary}
          <ResumePayment
            orgSlug={orgSlug}
            bookingId={outcome.bookingId}
            token={token}
            label={
              view === 'failed' ? t('publicBooking.outcome.retryPayment') : t('publicBooking.outcome.completePayment')
            }
            onSubmitted={onPaymentSubmitted}
            onUnavailable={onRefresh}
          />
          <BookingReference bookingId={outcome.bookingId} />
        </OutcomeLayout>
      );

    case 'awaitingEmail':
      return (
        <OutcomeLayout testId="checkout-onsite-request-sent" icon={<MailCheck className="h-12 w-12 text-amber-700" />}>
          <Heading title={t('publicBooking.onSiteRequest.sentTitle')}>
            {t('publicBooking.onSiteRequest.sentDescription', { orgName: org.displayName })}
          </Heading>
          <div className="bg-card rounded-lg p-4 space-y-2 text-left">
            <p className="font-medium">{t('publicBooking.onSiteRequest.nextStepsTitle')}</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                {guestEmail
                  ? deadline
                    ? t('publicBooking.onSiteRequest.stepConfirmEmail', { email: guestEmail, time: deadline })
                    : t('publicBooking.onSiteRequest.stepConfirmEmailNoTime', { email: guestEmail })
                  : deadline
                    ? t('publicBooking.outcome.stepConfirmEmailAnyAddress', { time: deadline })
                    : t('publicBooking.outcome.stepConfirmEmailAnyAddressNoTime')}
              </li>
              <li>{t('publicBooking.onSiteRequest.stepHostAnswers')}</li>
              <li>{t('publicBooking.onSiteRequest.stepPayOnSite')}</li>
            </ol>
          </div>
          {summary}
          <BookingReference bookingId={outcome.bookingId} />
          {refreshButton}
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );

    case 'awaitingHost':
      return (
        <OutcomeLayout testId="checkout-outcome-awaiting-host" icon={<MailCheck className="h-12 w-12 text-amber-700" />}>
          <Heading title={t('publicBooking.outcome.awaitingHostTitle')}>
            {deadline
              ? t('publicBooking.onSiteRequest.sentToHost', { date: deadline })
              : t('publicBooking.onSiteRequest.sentToHostNoDate')}
          </Heading>
          {summary}
          <BookingReference bookingId={outcome.bookingId} />
          {refreshButton}
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );

    case 'expired': {
      const paid = clientStatus === 'succeeded' || clientStatus === 'processing';
      return (
        <OutcomeLayout testId="checkout-outcome-expired" icon={<Clock className="h-12 w-12 text-muted-foreground" />}>
          <Heading title={t('publicBooking.outcome.expiredTitle')}>
            {outcome.paymentOption === 'OnSite'
              ? t('publicBooking.outcome.expiredRequestDescription')
              : t('publicBooking.outcome.expiredPaymentDescription')}
          </Heading>
          {paid && <p className="text-sm text-muted-foreground">{t('publicBooking.outcome.latePaymentNote')}</p>}
          {summary}
          {bookAgain}
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );
    }

    case 'declined':
      return (
        <OutcomeLayout testId="checkout-outcome-declined" icon={<XCircle className="h-12 w-12 text-destructive" />}>
          <Heading title={t('publicBooking.outcome.declinedTitle')}>
            {t('publicBooking.outcome.declinedDescription')}
          </Heading>
          {summary}
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );

    case 'datesUnavailable':
      return (
        <OutcomeLayout testId="checkout-outcome-dates-unavailable" icon={<XCircle className="h-12 w-12 text-destructive" />}>
          <Heading title={t('publicBooking.outcome.datesUnavailableTitle')}>
            {t('publicBooking.outcome.datesUnavailableDescription')}
          </Heading>
          {summary}
          <BookingReference bookingId={outcome.bookingId} />
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );

    case 'cancelled':
      return (
        <OutcomeLayout testId="checkout-outcome-cancelled" icon={<XCircle className="h-12 w-12 text-muted-foreground" />}>
          <Heading title={t('publicBooking.outcome.cancelledTitle')}>
            {t('publicBooking.outcome.cancelledDescription')}
          </Heading>
          {summary}
          <BookingReference bookingId={outcome.bookingId} />
          <BackToProperties orgSlug={orgSlug} />
        </OutcomeLayout>
      );
  }
}

/**
 * Pays the same hold again: the client secret of the booking's own intent comes from the backend, which answers 409 once
 * the hold has expired (`checkout_hold_expired`) or there is nothing left to pay.
 */
function ResumePayment({
  orgSlug,
  bookingId,
  token,
  label,
  onSubmitted,
  onUnavailable,
}: {
  orgSlug: string;
  bookingId: string;
  token: string;
  label: string;
  onSubmitted: (status: ClientPaymentStatus) => void;
  onUnavailable: () => void;
}) {
  const { t } = useTranslation();
  const resume = useResumeCheckoutPayment();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const session = resume.data;
  const clientSecret = session?.clientSecret || session?.setupIntentClientSecret;

  if (session && clientSecret) {
    return (
      <div className="space-y-3 text-left" data-testid="checkout-outcome-resume">
        <StripeIntentPayment
          publishableKey={session.connectedAccountPublishableContext.publishableKey}
          stripeAccountId={session.connectedAccountPublishableContext.stripeAccountId}
          clientSecret={clientSecret}
          mode={session.clientSecret ? 'payment' : 'setup'}
          returnUrl={`${window.location.origin}${buildCheckoutOutcomePath(orgSlug, bookingId, token)}`}
          onSubmitted={(status) => {
            setPaymentError(null);
            resume.reset();
            onSubmitted(status);
          }}
          onError={setPaymentError}
        />
        {paymentError && (
          <p className="text-sm text-destructive" role="alert" data-testid="checkout-outcome-payment-error">
            {paymentError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {resume.isError && (
        <p className="text-sm text-destructive" role="alert" data-testid="checkout-outcome-resume-error">
          {getProblemMessage(resume.error, t) ?? t('publicBooking.outcome.resumeError')}
        </p>
      )}
      <Button
        className="w-full"
        disabled={resume.isPending}
        onClick={() => resume.mutate({ bookingId, token }, { onError: onUnavailable })}
      >
        {resume.isPending ? t('publicBooking.preparingPayment') : label}
      </Button>
    </div>
  );
}

function OutcomeLayout({ testId, icon, children }: { testId: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg space-y-6 text-center" data-testid={testId}>
      <div className="flex justify-center">{icon}</div>
      {children}
    </div>
  );
}

function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function Polling() {
  const { t } = useTranslation();
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('publicBooking.outcome.checking')}
    </p>
  );
}

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-card rounded-lg p-4 space-y-2 text-left">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function StaySummary({ outcome }: { outcome: CheckoutOutcome }) {
  const { t, i18n } = useTranslation();
  const nights = nightsBetween(outcome.checkInDate, outcome.checkOutDate);
  return (
    <div className="bg-card rounded-lg p-4 space-y-1 text-left" data-testid="checkout-outcome-summary">
      <p className="font-semibold">{outcome.propertyName}</p>
      <p className="text-sm text-muted-foreground">
        {t('publicBooking.checkoutDates', {
          checkIn: formatStayDate(outcome.checkInDate, i18n.language),
          checkOut: formatStayDate(outcome.checkOutDate, i18n.language),
          count: nights,
        })}
      </p>
      <p className="text-sm">
        {t('publicBooking.totale')}: {formatCurrency(outcome.totalPrice, outcome.currency)}
      </p>
    </div>
  );
}

function BookingReference({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  return (
    <div className="bg-card rounded-lg p-4 space-y-2 text-left">
      <p className="text-xs font-medium text-muted-foreground">{t('publicBooking.bookingReference')}</p>
      <p className="font-mono text-lg font-semibold break-all">{bookingId}</p>
    </div>
  );
}

function BackToProperties({ orgSlug }: { orgSlug: string }) {
  const { t } = useTranslation();
  return (
    <Button asChild variant="outline" className="w-full">
      <Link to={buildOrgBookingPath(orgSlug)}>{t('publicBooking.backToProperties')}</Link>
    </Button>
  );
}
