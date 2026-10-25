import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { BackLink } from '@/components/shared/back-link';
import { useLease } from '@/queries/use-leases';
import {
  CF_ACCESS_POLL_LIMIT_MS,
  isCfAlreadyPurchased,
  useCfAccess,
  useCfCheckout,
  useCfConsumeGift,
  useOpenCfForm,
} from '@/queries/use-concordatofacile';
import { redirectToStripe } from '@/features/billing/billing-utils';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { cn, formatDateTime } from '@/lib/utils';

/**
 * The page of payment of the guided contract of a canone concordato (NF-02, ADR-005-R11-R14; CF-FLOW).
 * Route: /app/long-rent/leases/:id/guided-contract (the old /concordatofacile address, which Stripe still returns to, comes here).
 * It is reached from the sheet of the contract, by its main button, when the access is missing: the price, the steps and the way in
 * (pay, or the gift practice). Who already has the access and opens it (a bookmark, "back" of the browser) is sent back to the sheet,
 * where the form is opened. The form opens from here only straight after an act of the person on this page, in this same tab and
 * once: back from the payment (`?checkout=success`, which waits for the access that the webhook of Stripe can record after the
 * person is back) and after the gift practice is used. If the privacy notice is not accepted, the sheet asks for it first.
 * With the service off (`concordatoFacile`, CF-FIX) the page does not exist: the person goes back to the contract.
 */
export function ConcordatoFacileOfferPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { flags, isLoading } = useFeatureFlags();

  if (isLoading) {
    return <LoadingScreen message={t('concordatofacile.offer.processing')} />;
  }

  if (!flags.concordatoFacile) {
    return <Navigate to={id ? `/app/long-rent/leases/${id}` : '/app/long-rent/leases'} replace />;
  }

  return <GuidedContract />;
}

/** `?checkout=` as Stripe returns it: anything else is no result at all. */
function checkoutResultOf(value: string | null): 'success' | 'cancelled' | null {
  return value === 'success' || value === 'cancelled' ? value : null;
}

function GuidedContract() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  // Back from the payment the access is read again every two seconds, until it is there or about forty seconds have passed.
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);
  // Why the link could not be made, if it could not (the person can ask again).
  const [openError, setOpenError] = useState<unknown>(null);

  const checkoutResult = checkoutResultOf(searchParams.get('checkout'));

  const leaseQuery = useLease(id!);
  const accessQuery = useCfAccess(id!, { watch: checkoutResult === 'success' && !waitedLongEnough });
  const checkoutMutation = useCfCheckout();
  const giftMutation = useCfConsumeGift();
  // `mutateAsync` and not `mutate`: the result is read from the promise, so it does not depend on the observer of the mutation, which
  // the second run of the effects in development (StrictMode) detaches from a mutation started by the first.
  const { mutateAsync: openTheForm } = useOpenCfForm(id!, { replace: true });

  // The form opens by itself only straight after an act of the person on this page: back from the payment, or the gift practice used —
  // and once the privacy notice is accepted. ONE call for the link (it is worth 15 minutes and every call is recorded), whatever the
  // number of renders and the double run of the effects in development. The page is left with `replace`, so that "back" from the form
  // does not land here to be sent on again. A failure does not repeat itself: the person presses «Apri il modulo».
  const startsTheForm =
    accessQuery.data?.hasAccess === true &&
    accessQuery.data.privacyAccepted === true &&
    leaseQuery.isSuccess &&
    (checkoutResult === 'success' || giftMutation.isSuccess);
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!startsTheForm || !id || openedFor.current === id) return;
    openedFor.current = id;
    openTheForm().catch(setOpenError);
  }, [startsTheForm, id, openTheForm]);

  const waitingForPayment = checkoutResult === 'success' && accessQuery.data?.hasAccess === false;
  useEffect(() => {
    if (!waitingForPayment) return undefined;
    const timer = setTimeout(() => setWaitedLongEnough(true), CF_ACCESS_POLL_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [waitingForPayment]);

  const askAgain = () => {
    setOpenError(null);
    openTheForm().catch(setOpenError);
  };

  const handlePay = async () => {
    if (!id) return;
    setRedirecting(true);
    try {
      const result = await checkoutMutation.mutateAsync(id);
      redirectToStripe(result.sessionUrl);
    } catch {
      setRedirecting(false);
      // Error is handled by the mutation
    }
  };

  const handleGift = async () => {
    if (!id) return;
    try {
      await giftMutation.mutateAsync(id);
      // Access state is invalidated automatically by the mutation: the form opens as soon as it is read again
    } catch {
      // Error is handled below (409 conflict vs general error)
    }
  };

  if (!id) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t('concordatofacile.offer.error')}
        description={t('concordatofacile.offer.invalidLease')}
      />
    );
  }

  if (leaseQuery.isLoading || accessQuery.isLoading) {
    return <LoadingScreen message={t('concordatofacile.offer.processing')} />;
  }

  if (leaseQuery.isError) {
    const status = getHttpStatus(leaseQuery.error);
    if (status === 404 || status === 403) {
      return (
        <div className="space-y-6">
          <PageHeader title={t('concordatofacile.offer.title')} />
          <div className={FOCUS_COLUMN}>
            <Alert variant="danger">
              <div>
                <p className="font-semibold">{t('concordatofacile.offer.error')}</p>
                <p className="mt-1">{t('concordatofacile.offer.leaseNotFound')}</p>
                <div className="mt-3">
                  <Button size="sm" onClick={() => navigate('/app/long-rent/leases')}>
                    {t('concordatofacile.offer.backToLeases')}
                  </Button>
                </div>
              </div>
            </Alert>
          </div>
        </div>
      );
    }
    return <ErrorState title={t('concordatofacile.offer.loadError')} error={leaseQuery.error} />;
  }

  if (accessQuery.isError) {
    return <ErrorState title={t('concordatofacile.offer.accessError')} error={accessQuery.error} onRetry={() => void accessQuery.refetch()} />;
  }

  const lease = leaseQuery.data;
  const access = accessQuery.data;

  if (!lease || !access) {
    return <LoadingScreen />;
  }

  // The payment was cancelled: say so, and the way back to the page of the service (without the result in the address).
  if (checkoutResult === 'cancelled') {
    return (
      <div className="space-y-6">
        <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
        <div className={cn(FOCUS_COLUMN, 'space-y-4')}>
          <Alert variant="warning">{t('concordatofacile.offer.cancelled')}</Alert>
          <Button onClick={() => navigate(`/app/long-rent/leases/${id}/guided-contract`, { replace: true })}>
            {t('concordatofacile.offer.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  // The access is there. Straight after the payment or the gift practice the effect above opens the form: here only a calm wait, or what
  // to do when the link could not be made. Any other time (a bookmark, "back" of the browser, the privacy notice still to accept) the
  // sheet of the contract is the place: it opens the form from its main button.
  if (access.hasAccess) {
    if (!startsTheForm) {
      return <Navigate to={`/app/long-rent/leases/${id}`} replace />;
    }
    if (openError !== null) {
      return (
        <div className="space-y-6">
          <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
          <div className={cn(FOCUS_COLUMN, 'space-y-4')}>
            <Alert variant="warning" role="alert" data-testid="cf-open-error">
              {getProblemMessage(openError, t) ?? t('guidedContract.openError')}
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button onClick={askAgain} data-testid="cf-open-form">
                {t('guidedContract.open')}
              </Button>
              <Button asChild variant="outline">
                <Link to={`/app/long-rent/leases/${id}`}>{t('concordatofacile.offer.viewLease')}</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return <LoadingScreen message={t('guidedContract.opening')} />;
  }

  // Back from the payment and the access is not there yet: the webhook of Stripe can arrive after the person does. The access is read
  // again every two seconds for about forty (`useCfAccess`); after that the person is told it takes a moment and can look again.
  if (checkoutResult === 'success') {
    if (!waitedLongEnough) {
      return <LoadingScreen message={t('guidedContract.paymentReceived')} />;
    }
    return (
      <div className="space-y-6">
        <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
        <div className={cn(FOCUS_COLUMN, 'space-y-4')}>
          <Alert data-testid="cf-activation-pending">{t('guidedContract.paymentPending')}</Alert>
          <p className="text-sm text-muted-foreground">
            {t('guidedContract.lastCheck', { time: formatDateTime(new Date(accessQuery.dataUpdatedAt)) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void accessQuery.refetch()} loading={accessQuery.isFetching} data-testid="cf-check-again">
              {t('guidedContract.checkAgain')}
            </Button>
            <Button asChild variant="outline">
              <Link to={`/app/long-rent/leases/${id}`}>{t('concordatofacile.offer.viewLease')}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // The gift practice takes the place of the payment, and is mentioned only where there is one (the plans of 24 months are not on sale).
  const giftOffered = access.giftAvailable && !access.giftConsumed;

  return (
    <div className="space-y-6">
      <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />

      <BackLink to={`/app/long-rent/leases/${id}`} label={t('concordatofacile.offer.backToLease')} />

      <div className={cn(FOCUS_COLUMN, 'space-y-6')}>
        {/* Property and contract details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('concordatofacile.offer.contractDetails')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('concordatofacile.offer.property')}</dt>
                <dd className="text-sm">{lease.property?.name || t('leaseWizard.needs.property_missing')}</dd>
              </div>
              {lease.property?.city && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">{t('concordatofacile.offer.city')}</dt>
                  <dd className="text-sm">{lease.property.city}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Service description and price (ADR-005-R11) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('concordatofacile.offer.serviceTitle')}</CardTitle>
            <CardDescription>{t('concordatofacile.offer.serviceDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-lg font-semibold" data-testid="cf-offer-price">
                {t('concordatofacile.offer.price')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="cf-offer-taxes">
                {t('guidedContract.taxesNote')}
              </p>
            </div>

            {/* Five-step process (NF-02) */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t('concordatofacile.offer.stepsTitle')}</h3>
              <ol className="space-y-2 text-sm" data-testid="cf-offer-steps">
                <li className="flex gap-2">
                  <span className="font-medium">1.</span>
                  <span>{giftOffered ? t('guidedContract.stepPayOrGift') : t('concordatofacile.offer.step1')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium">2.</span>
                  <span>{t('concordatofacile.offer.step2')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium">3.</span>
                  <span>{t('concordatofacile.offer.step3')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium">4.</span>
                  <span>{t('concordatofacile.offer.step4')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium">5.</span>
                  <span>{t('concordatofacile.offer.step5')}</span>
                </li>
              </ol>
            </div>

            {/* Conditional buttons (NF-02) */}
            <div className="pt-4">
              {giftOffered ? (
                <Button
                  size="lg"
                  onClick={handleGift}
                  loading={giftMutation.isPending}
                  data-testid="cf-gift-button"
                  className="w-full"
                >
                  {t('concordatofacile.offer.giftButton')}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={handlePay}
                  loading={checkoutMutation.isPending || redirecting}
                  data-testid="cf-pay-button"
                  className="w-full"
                >
                  {t('concordatofacile.offer.payButton')}
                </Button>
              )}

              {checkoutMutation.isError && isCfAlreadyPurchased(checkoutMutation.error) && (
                <Alert role="alert" className="mt-4" data-testid="cf-already-purchased">
                  {t('apiErrors.codes.concordatofacileAlreadyPurchased')}
                </Alert>
              )}

              {checkoutMutation.isError && !isCfAlreadyPurchased(checkoutMutation.error) && (
                <Alert variant="danger" className="mt-4">
                  {t('concordatofacile.offer.checkoutError')}
                </Alert>
              )}

              {giftMutation.isError && (() => {
                const status = getHttpStatus(giftMutation.error);
                if (status === 409) {
                  return (
                    <Alert variant="danger" className="mt-4" role="alert" data-testid="gift-conflict">
                      {t('concordatofacile.gift.conflict')}
                    </Alert>
                  );
                }
                return (
                  <Alert variant="danger" className="mt-4">
                    {t('concordatofacile.gift.error')}
                  </Alert>
                );
              })()}
            </div>

            <Alert>{t('concordatofacile.offer.info')}</Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
