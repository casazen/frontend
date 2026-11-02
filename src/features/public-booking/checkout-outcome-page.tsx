import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useCheckoutOutcome } from '@/queries/use-public-booking';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { getProblemMessage, isTransientRequestError } from '@/lib/api-errors';
import { buildCheckoutOutcomePath, buildGuestBookingsPath } from '@/lib/booking-url';
import { clearPendingCheckout } from '@/lib/pending-checkout';
import { useSeoMeta } from '@/lib/seo-meta';
import { PublicSiteState } from '@/features/public-site/components/public-site-state';
import { ConfirmationScreen } from '@/features/public-booking/confirmation/confirmation-screen';
import '@/features/public-booking/confirmation/confirmation.css';
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
import type { PublicOrgDto } from '@/types';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** What the checkout hands to this page when it navigates here (never in the URL). */
export interface CheckoutOutcomeLocationState {
  /** Result of the guest's own payment attempt in the page (`confirmPayment` / `confirmSetup`). */
  clientStatus?: ClientPaymentStatus;
  /** The address the confirmation email was sent to, only to say where to look. */
  guestEmail?: string;
  /** The first name the guest booked with, only to greet them in the title. */
  guestFirstName?: string;
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
    guestFirstName: typeof value.guestFirstName === 'string' ? value.guestFirstName : undefined,
  };
}

/**
 * Outcome page of a public checkout, `/book/:orgSlug/booking/:bookingId?token=…` (BK-07, A3-15, DB-06b). It shows the real state of
 * the booking from the backend, never «Prenotazione confermata» before the confirmation: payment being confirmed (e.g. SEPA), failed
 * with a retry on the same hold, a request to pay in the property waiting for the email or the host, expired. It is also the Stripe
 * `return_url` of the redirect methods: the guest comes back to their booking, not to an empty checkout whose new booking their own
 * hold would block. The address carries a token, so the page is never indexed and keeps no Stripe parameter in it.
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

  useSeoMeta({ title: t('siteConfirm.pageTitle', { org: org.displayName }), noindex: true });

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
      <PublicSiteState
        icon={AlertCircle}
        role="alert"
        testId="checkout-outcome-invalid"
        title={t('siteConfirm.invalid.title')}
        description={t('publicBooking.outcome.linkIncomplete')}
      >
        <Button asChild>
          <Link to={buildGuestBookingsPath(orgSlug)}>{t('siteConfirm.action.findBooking')}</Link>
        </Button>
      </PublicSiteState>
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
      guestFirstName={locationState.guestFirstName}
    />
  );
}

/** The shape of the page while the state of the booking is being read: the proportions of the real one, so nothing jumps. */
function OutcomeSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="bc" data-testid="checkout-outcome-loading" role="status" aria-busy="true">
      <span className="sr-only">{t('publicBooking.outcome.loading')}</span>
      <div className="bc-skel" aria-hidden="true">
        <div className="bc-skel__copy">
          <span className="bc-skel__block bc-skel__seal" />
          <span className="bc-skel__block bc-skel__title" />
          <span className="bc-skel__block bc-skel__line" />
          <span className="bc-skel__block bc-skel__btn" />
        </div>
        <span className="bc-skel__block bc-skel__ticket" />
      </div>
    </div>
  );
}

function OutcomeContent({
  org,
  orgSlug,
  bookingId,
  token,
  initialClientStatus,
  guestEmail,
  guestFirstName,
}: {
  org: PublicOrgDto;
  orgSlug: string;
  bookingId: string;
  token: string;
  initialClientStatus: ClientPaymentStatus | null;
  guestEmail?: string;
  guestFirstName?: string;
}) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const outcome = useCheckoutOutcome(bookingId, token);
  const [clientStatus, setClientStatus] = useState(initialClientStatus);
  const [attempt, setAttempt] = useState(0);
  const { data, isFetching, refetch } = outcome;
  // The photo, the zone, the hours and the host come from the public record of the house; the page does not wait for it.
  const property = useOrgPublicProperty(orgSlug, data ? (data.propertySlug ?? data.propertyId) : undefined).data;
  const view: OutcomeView | null = data ? resolveOutcomeView(data.state, clientStatus) : null;
  const intermediate = view !== null && isIntermediateView(view, clientStatus);
  const pollingStopped = intermediate && attempt >= MAX_POLL_ATTEMPTS;

  // Polling with backoff while someone else still has to act (Stripe and its webhook, the guest's email, the host). Paused while the
  // browser is offline, and started again when it is back.
  useEffect(() => {
    if (!intermediate || pollingStopped || isFetching || !online) return undefined;
    const timer = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      void refetch();
    }, nextPollDelay(attempt));
    return () => window.clearTimeout(timer);
  }, [intermediate, pollingStopped, isFetching, online, attempt, refetch]);

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
        <PublicSiteState
          icon={AlertCircle}
          role="alert"
          testId="checkout-outcome-error"
          title={t('siteConfirm.error.title')}
          description={getProblemMessage(outcome.error, t) ?? t('publicBooking.outcome.loadError')}
        >
          {transient ? (
            <Button onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              {t('publicBooking.outcome.retryLoad')}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to={buildGuestBookingsPath(orgSlug)}>{t('siteConfirm.action.findBooking')}</Link>
          </Button>
        </PublicSiteState>
      );
    }
    return <OutcomeSkeleton />;
  }

  return (
    <ConfirmationScreen
      view={view}
      outcome={data}
      org={org}
      orgSlug={orgSlug}
      token={token}
      property={property}
      clientStatus={clientStatus}
      guestEmail={guestEmail}
      guestFirstName={guestFirstName}
      pollingStopped={pollingStopped}
      refreshing={isFetching}
      online={online}
      onRefresh={refresh}
      onPaymentSubmitted={onPaymentSubmitted}
    />
  );
}
