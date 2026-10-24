import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Info, Loader2, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { PageHeader } from '@/components/layout/page-header';
import { BackLink } from '@/components/shared/back-link';
import { useLease } from '@/queries/use-leases';
import { useCfAccess, useCfCheckout, useCfConsumeGift } from '@/queries/use-concordatofacile';
import { redirectToStripe } from '@/features/billing/billing-utils';
import { getHttpStatus } from '@/lib/api-errors';
import { useAuth } from '@/hooks/use-auth';
import { isAdmin } from '@/lib/auth-roles';

/**
 * ConcordatoFacile offer page (NF-02, ADR-005-R11-R14).
 * Route: /app/long-rent/leases/:id/concordatofacile
 * Displays service info, price, and handles checkout or gift consumption.
 */
export function ConcordatoFacileOfferPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  const { user } = useAuth();

  const leaseQuery = useLease(id!);
  const accessQuery = useCfAccess(id!);
  const checkoutMutation = useCfCheckout();
  const giftMutation = useCfConsumeGift();

  const checkoutResult = searchParams.get('checkout');
  const userIsAdmin = isAdmin(user);

  // If user has access, redirect to link generation flow (AC-NF02-4 interpretation: show access granted)
  useEffect(() => {
    if (accessQuery.data?.hasAccess && !checkoutResult) {
      // Redirect to lease detail or CF link generation (simplified: just show success for now)
      // In full implementation, this would redirect to the link generation flow
      // For this task, we handle it by showing a message
    }
  }, [accessQuery.data, checkoutResult, navigate, id]);

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
      // Access state is invalidated automatically by the mutation
    } catch {
      // Error is handled below (409 conflict vs general error)
    }
  };

  const handleAdminAccess = () => {
    if (!id) return;
    // Redirect to lease detail (link generation flow handled there)
    navigate(`/app/long-rent/leases/${id}`);
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
        <div className="container max-w-3xl py-8">
          <Alert variant="danger">
            <AlertCircle className="size-4" />
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
      );
    }
    return <ErrorState title={t('concordatofacile.offer.loadError')} error={leaseQuery.error} />;
  }

  if (accessQuery.isError) {
    return <ErrorState title={t('concordatofacile.offer.accessError')} error={accessQuery.error} />;
  }

  const lease = leaseQuery.data;
  const access = accessQuery.data;

  if (!lease || !access) {
    return <LoadingScreen />;
  }

  // Show success message after checkout
  if (checkoutResult === 'success') {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
        <Alert variant="success" className="mt-6">
          <CheckCircle2 className="size-4" />
          {t('concordatofacile.offer.success')}
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate(`/app/long-rent/leases/${id}`)}>
            {t('concordatofacile.offer.viewLease')}
          </Button>
        </div>
      </div>
    );
  }

  // Show cancelled message
  if (checkoutResult === 'cancelled') {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
        <Alert variant="warning" className="mt-6">
          <AlertCircle className="size-4" />
          {t('concordatofacile.offer.cancelled')}
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate(`/app/long-rent/leases/${id}/concordatofacile`)}>
            {t('concordatofacile.offer.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  // Admin with access via bypass - show admin-specific confirmation (AC-NF04-1)
  if (access.hasAccess && access.source === 'admin') {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
        <Alert variant="info" className="mt-6">
          <ShieldCheck className="size-4" />
          {t('concordatofacile.offer.adminBypass')}
        </Alert>
        <div className="mt-4">
          <Button onClick={handleAdminAccess}>
            {t('concordatofacile.offer.adminAccessButton')}
          </Button>
        </div>
      </div>
    );
  }

  // User already has access - show confirmation
  if (access.hasAccess) {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
        <Alert variant="success" className="mt-6">
          <CheckCircle2 className="size-4" />
          {t('concordatofacile.offer.hasAccess')}
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate(`/app/long-rent/leases/${id}`)}>
            {t('concordatofacile.offer.proceed')}
          </Button>
        </div>
      </div>
    );
  }

  // Edge case: admin without access (shouldn't happen per backend logic)
  // Handle gracefully by redirecting to link generation (task requirement)
  if (userIsAdmin && !access.hasAccess) {
    return (
      <div className="container max-w-3xl py-8">
        <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />
        <Alert variant="warning" className="mt-6">
          <AlertCircle className="size-4" />
          {t('concordatofacile.offer.adminNoAccess')}
        </Alert>
        <div className="mt-4">
          <Button onClick={handleAdminAccess}>
            {t('concordatofacile.offer.proceed')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <PageHeader title={t('concordatofacile.offer.title')} crumbs="auto" />

      <BackLink to={`/app/long-rent/leases/${id}`} label={t('concordatofacile.offer.backToLease')} className="mt-4" />

      <div className="mt-6 space-y-6">
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
            </div>

            {/* Five-step process (NF-02) */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">{t('concordatofacile.offer.stepsTitle')}</h3>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="font-medium">1.</span>
                  <span>{t('concordatofacile.offer.step1')}</span>
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
              {access.giftAvailable && !access.giftConsumed ? (
                <Button
                  size="lg"
                  onClick={handleGift}
                  disabled={giftMutation.isPending}
                  data-testid="cf-gift-button"
                  className="w-full"
                >
                  {giftMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t('concordatofacile.offer.giftButton')}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={handlePay}
                  disabled={checkoutMutation.isPending || redirecting}
                  data-testid="cf-pay-button"
                  className="w-full"
                >
                  {(checkoutMutation.isPending || redirecting) && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t('concordatofacile.offer.payButton')}
                </Button>
              )}

              {checkoutMutation.isError && (
                <Alert variant="danger" className="mt-4">
                  <AlertCircle className="size-4" />
                  {t('concordatofacile.offer.checkoutError')}
                </Alert>
              )}

              {giftMutation.isError && (() => {
                const status = getHttpStatus(giftMutation.error);
                if (status === 409) {
                  return (
                    <Alert variant="danger" className="mt-4" role="alert" data-testid="gift-conflict">
                      <AlertCircle className="size-4" />
                      {t('concordatofacile.gift.conflict')}
                    </Alert>
                  );
                }
                return (
                  <Alert variant="danger" className="mt-4">
                    <AlertCircle className="size-4" />
                    {t('concordatofacile.gift.error')}
                  </Alert>
                );
              })()}
            </div>

            <Alert>
              <Info className="size-4" />
              {t('concordatofacile.offer.info')}
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
