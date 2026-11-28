import { useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CommercialSignupApi } from '@/api/commercial-signup.api';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_MAIN_ASIDE } from '@/components/layout/page-columns';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { BillingAdminRequired } from '@/features/billing/components/billing-admin-required';
import { applicableAddons, signupRentalType } from '@/features/onboarding/commercial-model';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { toBillingReturnPath } from '@/lib/billing-routes';
import { getPlanTierLabel } from '@/lib/i18n-labels';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useBillingPlans, useOpenBillingPortal } from '@/queries/use-billing';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import { arePricesPending, pickShownTier, readPlanUsage, type PortalHandle } from './account-billing-model';
import { BillingDataSection } from './billing-data-section';
import { CheckoutReturnNote } from './checkout-return-note';
import { PlanCompare } from './plan-compare';
import { PlanFocus } from './plan-focus';
import { SubscriptionStates } from './subscription-states';
import { useAccountSubscription } from './use-account-subscription';

function AccountBillingBody() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { planTier, user: commercialProfile, isLoading: profileLoading } = useCurrentUser();
  const entitlementQuery = useEntitlement();
  const plansQuery = useBillingPlans();
  const signup = commercialProfile?.commercialSignup;
  const { data: catalog } = useQuery({
    queryKey: ['billing', 'commercial-catalog'],
    queryFn: CommercialSignupApi.getCatalog,
    enabled: !!signup,
  });
  const { subscriptionQuery, checkoutReturn, timedOut } = useAccountSubscription();
  const portalMutation = useOpenBillingPortal(toBillingReturnPath(pathname));
  const compareRef = useRef<HTMLDetailsElement>(null);

  const portal: PortalHandle = { open: () => portalMutation.mutate(), pending: portalMutation.isPending };

  const subscription = subscriptionQuery.data;
  const entitlement = entitlementQuery.data;
  const usage = readPlanUsage(entitlement);
  const openAccess = entitlement?.openAccess === true;
  const tier = subscription ? pickShownTier(openAccess, subscription, planTier) : null;
  const pricesPending = subscription ? arePricesPending(plansQuery.data, subscription.status) : false;
  const modules = signup && catalog
    ? applicableAddons(catalog, commercialProfile?.rentalType ?? signupRentalType(signup))
    : [];
  const activeModules = subscription && ['active', 'trialing', 'past_due'].includes(subscription.status)
    ? subscription.enabledAddons ?? commercialProfile?.commercialEnabledAddons ?? []
    : [];

  const openPlans = () => {
    const section = compareRef.current;
    if (!section) return;
    section.open = true;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    section.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    section.querySelector('summary')?.focus();
  };

  let content: ReactNode;
  if (!subscription && subscriptionQuery.isError) {
    content = (
      <div role="alert" data-testid="billing-error" className="space-y-3">
        <p className="break-words text-sm text-destructive">{getProblemMessage(subscriptionQuery.error, t) ?? t('billing.settings.loadError')}</p>
        <Button type="button" variant="outline" onClick={() => void subscriptionQuery.refetch()}>
          {t('shared.errorFallback.tryAgain')}
        </Button>
      </div>
    );
  } else if (!subscription || !tier || profileLoading || entitlementQuery.isLoading || plansQuery.isPending) {
    // The plan block says different things once the entitlement and the plans are known (open access, prices not defined): it waits for
    // them, so that the words do not change under the person's eyes.
    content = (
      <div data-testid="billing-loading">
        <SkeletonCard lines={4} label={t('accountBilling.loading')} />
      </div>
    );
  } else {
    content = (
      <div className="space-y-8">
        <CheckoutReturnNote
          checkoutReturn={checkoutReturn}
          subscription={subscription}
          timedOut={timedOut}
          onRefresh={() => void subscriptionQuery.refetch()}
        />

        <div className={PAGE_MAIN_ASIDE}>
          <div className="min-w-0 space-y-8">
            <PlanFocus
              subscription={subscription}
              tier={tier}
              usage={usage}
              openAccess={openAccess}
              pricesPending={pricesPending}
              onOpenPlans={openPlans}
              portal={portal}
            />

            <PlainSection title={t('accountBilling.payment.title')} data-testid="account-billing-payment">
              <div className="space-y-3">
                <p className="break-words text-sm">{t('accountBilling.payment.text')}</p>
                {subscription.status !== 'none' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight"
                    onClick={portal.open}
                    loading={portal.pending}
                    data-testid="billing-portal-button"
                  >
                    {t('accountBilling.payment.open')}
                  </Button>
                ) : (
                  <p className="break-words text-sm text-foreground/70">{t('accountBilling.payment.noSubscription')}</p>
                )}
              </div>
            </PlainSection>
            {modules.length > 0 && (
              <PlainSection title={t('commercial.moduleStatus')}>
                <dl className="space-y-2 text-sm">
                  {modules.map(module => (
                    <div key={module.code} className="flex justify-between gap-4">
                      <dt>{t(`commercial.addons.${module.code}.title`)}</dt>
                      <dd>{t(activeModules.includes(module.code) ? 'commercial.moduleActive' : 'commercial.moduleInactive')}</dd>
                    </div>
                  ))}
                </dl>
              </PlainSection>
            )}
          </div>

          <div className="min-w-0 border-b border-border">
            <PlanCompare
              detailsRef={compareRef}
              plansQuery={plansQuery}
              subscription={subscription}
              tier={tier}
              usage={usage}
              portal={portal}
              onAlreadySubscribed={() => void subscriptionQuery.refetch()}
              showModulesNote={!!signup}
            />
            <BillingDataSection subscription={subscription} />
            <SubscriptionStates status={subscription.status} />
            {commercialProfile?.commercialSignup && <div className="space-y-3 py-5"><h2 className="font-semibold">{t('commercial.rentalAreas')}</h2>{commercialProfile.commercialSignup.profile === 'agency' && <p className="text-sm">{t('commercial.agency.count', { count: subscription.roomQuantity ?? 0 })}</p>}<p className="text-sm text-muted-foreground">{t('commercial.manageAreasText')}</p><Button asChild variant="outline"><Link to="/onboarding?mode=edit">{t('commercial.manageAreas')}</Link></Button></div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="account-billing-page">
      <PageHeader
        title={t('accountBilling.title')}
        description={tier ? t('accountBilling.description', { plan: getPlanTierLabel(tier, t) }) : t('accountBilling.descriptionGeneric')}
        crumbs="auto"
      />
      {content}
    </div>
  );
}

/**
 * "Fatturazione e piano" of the account area (AM-08a): what CasaZen costs the org, how much of it is used, how it pays, and the
 * details of the invoices, in one page for the owner and the administrators. It is the plan page and the billing page of the rental
 * areas made one, with the same endpoints, checks and permissions (the billing administrator; anyone else is told whom to ask), and
 * the same return of Stripe's checkout and portal. One highlighted block (the plan with its use), the rest quiet; the plans, the
 * billing data and the meaning of the states open on request. The list of the invoices of CasaZen, the seats of each plan and the
 * closing of the account wait for their backend (see the report of the task).
 */
export function AccountBillingPage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();

  if (!isOrgBillingAdmin(contexts)) {
    return (
      <div className="space-y-6" data-testid="account-billing-page">
        <PageHeader title={t('accountBilling.title')} description={t('accountBilling.descriptionGeneric')} crumbs="auto" />
        <BillingAdminRequired />
      </div>
    );
  }
  return <AccountBillingBody />;
}
