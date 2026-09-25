import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Info, Loader2, PackageOpen } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useWorkspace } from '@/hooks/use-workspace';
import { toBillingReturnPath } from '@/lib/billing-routes';
import { getPlanTierLabel } from '@/lib/i18n-labels';
import { needsOrgSetup } from '@/lib/onboarding';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { cn } from '@/lib/utils';
import {
  useBillingPlans,
  useBillingSubscription,
  useOpenBillingPortal,
  useRefreshPlanAfterPayment,
} from '@/queries/use-billing';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import type { BillingPlan, BillingSubscription, PlanTier } from '@/types';
import {
  CHECKOUT_CONFIRM_POLL_MS,
  CHECKOUT_CONFIRM_TIMEOUT_MS,
  CHECKOUT_RETURN_PARAM,
  formatPlanPrice,
  isLiveSubscription,
  isPaidStatus,
  needsPaymentAction,
  readCheckoutReturn,
} from './billing-utils';
import { BillingAdminRequired } from './components/billing-admin-required';
import { CheckoutDialog } from './components/checkout-dialog';
import { SubscriptionPaymentNotice } from './components/subscription-status-notice';

type PlanAction = 'current' | 'portal' | 'unavailable' | 'checkout';

/** The return of a checkout is settled once Stripe reports a paid plan or a payment problem. */
function isCheckoutSettled(subscription: BillingSubscription | undefined): boolean {
  return !!subscription && (isPaidStatus(subscription.status) || needsPaymentAction(subscription.status));
}

/**
 * Plans and Stripe Checkout of the org (spec-saas-billing AC10, PL-12) in the short-rent shell. Also the default return
 * page of the checkout (`?checkout=success|cancel`) and of the billing portal (backend PL-11).
 */
export function PlansPage() {
  return (
    <AppShell>
      <PlansPageContent />
    </AppShell>
  );
}

/**
 * Content of the plans page, without a shell: the short-rent route wraps it in its shell ({@link PlansPage}), the
 * long-rent route gets the long-rent shell from the context layout (PL-16). Also the return page of the checkout
 * (`?checkout=success|cancel`) and of the billing portal started from this page: the outcome shown is the subscription
 * read from the backend, never the redirect alone.
 */
export function PlansPageContent() {
  const { t, i18n } = useTranslation();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { org, planTier, user } = useCurrentUser();
  const { data: entitlement } = useEntitlement();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutReturn] = useState(() => readCheckoutReturn(searchParams));
  const [confirmTimedOut, setConfirmTimedOut] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlan | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const plansQuery = useBillingPlans(isAdmin);
  const subscriptionQuery = useBillingSubscription({
    enabled: isAdmin,
    pollInterval: (data) =>
      checkoutReturn === 'success' && !confirmTimedOut && !isCheckoutSettled(data) ? CHECKOUT_CONFIRM_POLL_MS : false,
  });
  const { pathname } = useLocation();
  // The portal links back to this page, in the shell the user is in (PL-16).
  const portal = useOpenBillingPortal(toBillingReturnPath(pathname));
  const refreshPlan = useRefreshPlanAfterPayment();

  const subscription = subscriptionQuery.data;
  const status = subscription?.status ?? 'none';
  const confirmed = checkoutReturn === 'success' && !!subscription && isPaidStatus(subscription.status);

  // The Stripe return parameter is read once, then removed: a reload does not show the outcome again.
  useEffect(() => {
    if (!searchParams.has(CHECKOUT_RETURN_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(CHECKOUT_RETURN_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (checkoutReturn !== 'success') return;
    const timer = window.setTimeout(() => setConfirmTimedOut(true), CHECKOUT_CONFIRM_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [checkoutReturn]);

  // Paid plan confirmed by the backend: the profile badge and the limits are read again.
  useEffect(() => {
    if (confirmed) refreshPlan();
  }, [confirmed, refreshPlan]);

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  const live = isLiveSubscription(status);
  const currentTier: PlanTier | null = planTier;

  const actionFor = (plan: BillingPlan): PlanAction => {
    if (plan.tier === currentTier) return 'current';
    if (live) return 'portal';
    if (!plan.purchasable) return 'unavailable';
    return 'checkout';
  };

  const openPortal = () => portal.mutate();

  const handleAlreadySubscribed = () => {
    setCheckoutPlan(null);
    setAlreadySubscribed(true);
    void subscriptionQuery.refetch();
  };

  const retry = () => {
    if (plansQuery.isError) void plansQuery.refetch();
    if (subscriptionQuery.isError) void subscriptionQuery.refetch();
  };

  const renderReturnBanner = () => {
    if (checkoutReturn === 'cancel') {
      return (
        <Banner tone="info" testId="checkout-return-canceled">
          {t('billing.checkout.return.canceled')}
        </Banner>
      );
    }
    if (checkoutReturn !== 'success' || !subscriptionQuery.isSuccess) return null;
    const current = subscriptionQuery.data;
    if (isPaidStatus(current.status)) {
      return (
        <Banner tone="success" testId="checkout-return-confirmed">
          {t('billing.checkout.return.confirmed', { plan: getPlanTierLabel(current.planTier, t) })}
        </Banner>
      );
    }
    // A payment problem is explained by the payment notice below.
    if (isCheckoutSettled(current)) return null;
    if (!confirmTimedOut) {
      return (
        <Banner tone="info" testId="checkout-return-confirming" busy>
          {t('billing.checkout.return.confirming')}
        </Banner>
      );
    }
    return (
      <Banner tone="info" testId="checkout-return-pending">
        <span>{t('billing.checkout.return.pending')}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void subscriptionQuery.refetch()}>
          {t('billing.checkout.return.refresh')}
        </Button>
      </Banner>
    );
  };

  const renderPlans = () => {
    if (plansQuery.isPending || subscriptionQuery.isPending) {
      return (
        <div className="grid gap-6 md:grid-cols-3" data-testid="billing-plans-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      );
    }
    if (plansQuery.isError || subscriptionQuery.isError) {
      return (
        <div role="alert" data-testid="billing-plans-error" className="space-y-3 rounded-md border border-destructive/40 p-4 text-sm">
          <p className="text-destructive">{t('billing.plans.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        </div>
      );
    }
    if (plansQuery.data.length === 0) {
      return (
        <div data-testid="billing-plans-empty">
          <EmptyState icon={PackageOpen} title={t('billing.plans.emptyTitle')} description={t('billing.plans.emptyDescription')} />
        </div>
      );
    }
    return (
      <div className="grid gap-6 text-left md:grid-cols-3" data-testid="billing-plans-grid">
        {plansQuery.data.map((plan) => (
          <BillingPlanCard
            key={plan.tier}
            plan={plan}
            action={actionFor(plan)}
            locale={i18n.language}
            portalPending={portal.isPending}
            onCheckout={() => {
              setAlreadySubscribed(false);
              setCheckoutPlan(plan);
            }}
            onPortal={openPortal}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t('settings.planTitle')}
        description={
          org ? t('settings.planOrgDescription', { orgName: org.name }) : t('settings.planDefaultDescription')
        }
      />

      {!isAdmin ? (
        <BillingAdminRequired />
      ) : (
        <>
          {renderReturnBanner()}

          {alreadySubscribed && (
            <Banner tone="warning" testId="already-subscribed-alert">
              <span>{t('apiErrors.codes.alreadySubscribed')}</span>
              <Button type="button" size="sm" onClick={openPortal} disabled={portal.isPending}>
                {portal.isPending ? t('billing.portal.opening') : t('billing.portal.open')}
              </Button>
            </Banner>
          )}

          {subscriptionQuery.isSuccess && (
            <SubscriptionPaymentNotice status={status} onOpenPortal={openPortal} portalPending={portal.isPending} />
          )}

          {subscriptionQuery.isSuccess && live && !needsPaymentAction(status) && !alreadySubscribed && (
            <Banner tone="info" testId="live-subscription-notice">
              <span>{t('billing.plans.liveSubscription')}</span>
              <Button type="button" size="sm" variant="outline" onClick={openPortal} disabled={portal.isPending}>
                {portal.isPending ? t('billing.portal.opening') : t('billing.portal.manage')}
              </Button>
            </Banner>
          )}

          {entitlement && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm" data-testid="plan-usage-summary">
              <p>
                {t('settings.currentUsage')} <strong>{entitlement.usage.properties}</strong>{' '}
                {t('settings.planUsage', {
                  propertyCount: entitlement.usage.properties,
                  maxProperties:
                    entitlement.limits.maxProperties >= 1_000_000
                      ? t('settings.unlimited')
                      : entitlement.limits.maxProperties,
                })}
                .
              </p>
            </div>
          )}

          {renderPlans()}

          <p className="text-sm text-muted-foreground">
            {t('billing.plans.stripeNote')}{' '}
            <Link to="../billing" relative="path" className="underline" data-testid="billing-settings-link">
              {t('billing.plans.billingLink')}
            </Link>
          </p>

          <CheckoutDialog
            plan={checkoutPlan}
            subscription={subscription}
            onClose={() => setCheckoutPlan(null)}
            onAlreadySubscribed={handleAlreadySubscribed}
          />
        </>
      )}
    </div>
  );
}

interface BillingPlanCardProps {
  plan: BillingPlan;
  action: PlanAction;
  locale: string;
  portalPending: boolean;
  onCheckout: () => void;
  onPortal: () => void;
}

function BillingPlanCard({ plan, action, locale, portalPending, onCheckout, onPortal }: BillingPlanCardProps) {
  const { t } = useTranslation();
  // Prices come only from the API (backend configuration); without one, Stripe Checkout shows it.
  const price = plan.priceMonthly > 0 ? formatPlanPrice(plan.priceMonthly, plan.currency, locale) : '';

  return (
    <Card
      data-testid={`plan-card-${plan.tier}`}
      className={cn('flex flex-col', action === 'current' && 'border-primary/60 ring-1 ring-primary/30')}
    >
      <CardHeader>
        <CardTitle>{plan.displayName}</CardTitle>
        <CardDescription data-testid={`plan-price-${plan.tier}`}>
          {price ? t('billing.plans.pricePerMonth', { price }) : t('billing.plans.priceAtCheckout')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {plan.unitAllowance < 0
            ? t('plan.unlimitedProperties')
            : t('plan.upToProperties', { count: plan.unitAllowance })}
        </p>
        {plan.features.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {plan.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        )}
        <div className="mt-auto space-y-2">
          {action === 'current' && (
            <Button type="button" className="w-full" variant="secondary" disabled>
              {t('plan.currentPlan')}
            </Button>
          )}
          {action === 'checkout' && (
            <Button type="button" className="w-full" onClick={onCheckout}>
              {t('plan.choosePlan')}
            </Button>
          )}
          {action === 'portal' && (
            <Button type="button" className="w-full" variant="outline" onClick={onPortal} disabled={portalPending}>
              {t('billing.plans.changeInPortal')}
            </Button>
          )}
          {action === 'unavailable' && (
            <>
              <Button type="button" className="w-full" variant="outline" disabled>
                {t('billing.plans.unavailable')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('billing.plans.unavailableHint')}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface BannerProps {
  tone: 'info' | 'success' | 'warning';
  testId: string;
  busy?: boolean;
  children: ReactNode;
}

function Banner({ tone, testId, busy = false, children }: BannerProps) {
  const Icon = busy ? Loader2 : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div
      role={tone === 'warning' ? 'alert' : 'status'}
      data-testid={testId}
      className={cn(
        'flex flex-col gap-3 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        tone === 'success' && 'border-green-600/40 bg-green-600/10',
        tone === 'warning' && 'border-amber-500/50 bg-amber-500/10',
        tone === 'info' && 'bg-muted/40',
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', busy && 'animate-spin')} aria-hidden />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
      </div>
    </div>
  );
}
