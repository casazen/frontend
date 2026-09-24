import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PlanBadge } from '@/components/org/plan-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getPlanTierLabel } from '@/lib/i18n-labels';
import { needsOrgSetup } from '@/lib/onboarding';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useBillingSubscription, useOpenBillingPortal, useUpdateBillingProfile } from '@/queries/use-billing';
import { useCurrentUser } from '@/queries/use-users';
import type { BillingSubscription, BillingSubscriptionStatus, PlanTier } from '@/types';
import { toBillingProfileRequest } from './billing-profile.schema';
import { formatBillingDate } from './billing-utils';
import { BillingAdminRequired } from './components/billing-admin-required';
import { BillingProfileForm } from './components/billing-profile-form';
import { SubscriptionStatusBadge } from './components/subscription-status-badge';
import { SubscriptionPaymentNotice } from './components/subscription-status-notice';

/**
 * Subscription, Stripe billing portal and billing profile of the org (spec-saas-billing AC11-AC13, PL-12). Paths to
 * the plan page are relative, so the page does not depend on the short-rent context.
 */
export function BillingSettingsPage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { user, planTier } = useCurrentUser();
  const subscriptionQuery = useBillingSubscription({ enabled: isAdmin });

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  const renderContent = () => {
    if (!isAdmin) return <BillingAdminRequired />;
    if (subscriptionQuery.isPending) {
      return (
        <div className="space-y-4" data-testid="billing-loading">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      );
    }
    if (subscriptionQuery.isError) {
      return (
        <div
          role="alert"
          data-testid="billing-error"
          className="space-y-3 rounded-md border border-destructive/40 p-4 text-sm"
        >
          <p className="text-destructive">{t('billing.settings.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void subscriptionQuery.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        </div>
      );
    }
    return (
      <>
        <SubscriptionCard subscription={subscriptionQuery.data} effectiveTier={planTier} />
        <BillingProfileCard subscription={subscriptionQuery.data} />
      </>
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={t('billing.settings.title')} description={t('billing.settings.description')} />
        {renderContent()}
      </div>
    </AppShell>
  );
}

/** Short explanation of a paying subscription; the payment problems have their own notice. */
const STATUS_HINT_KEY: Partial<Record<BillingSubscriptionStatus, string>> = {
  active: 'billing.settings.statusHint.active',
  trialing: 'billing.settings.statusHint.trialing',
};

interface SubscriptionCardProps {
  subscription: BillingSubscription;
  /** Plan actually granted (`/users/me`): Starter while no payment gives access to the paid one. */
  effectiveTier: PlanTier | null;
}

function SubscriptionCard({ subscription, effectiveTier }: SubscriptionCardProps) {
  const { t, i18n } = useTranslation();
  const portal = useOpenBillingPortal();
  const { status } = subscription;
  const hintKey = STATUS_HINT_KEY[status];
  const tier = effectiveTier ?? subscription.planTier;
  const nextDue =
    subscription.currentPeriodEnd && status !== 'canceled' && status !== 'none'
      ? formatBillingDate(subscription.currentPeriodEnd, i18n.language)
      : '';

  if (status === 'none') {
    return (
      <Card data-testid="subscription-empty">
        <CardHeader>
          <CardTitle className="text-xl">{t('billing.settings.noneTitle')}</CardTitle>
          <CardDescription>
            {t('billing.settings.noneDescription', { plan: getPlanTierLabel(tier, t) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="../plan" relative="path">
              <CreditCard className="h-4 w-4" aria-hidden />
              {t('billing.settings.choosePlan')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="subscription-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('billing.settings.subscriptionTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t('billing.settings.plan')}</dt>
            <dd className="mt-1">
              <PlanBadge planTier={tier} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('billing.settings.status')}</dt>
            <dd className="mt-1">
              <SubscriptionStatusBadge status={status} />
            </dd>
          </div>
          {nextDue && (
            <div>
              <dt className="text-muted-foreground">{t('billing.settings.nextDue')}</dt>
              <dd className="mt-1 font-medium" data-testid="subscription-next-due">
                {nextDue}
              </dd>
            </div>
          )}
        </dl>

        <SubscriptionPaymentNotice status={status} onOpenPortal={() => portal.mutate()} portalPending={portal.isPending} />

        {status === 'canceled' && (
          <p className="text-sm text-muted-foreground" data-testid="subscription-canceled-message">
            {t('billing.notice.canceled')}
          </p>
        )}
        {hintKey && <p className="text-sm text-muted-foreground">{t(hintKey)}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={status === 'canceled' ? 'outline' : 'default'}
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
            data-testid="billing-portal-button"
          >
            {portal.isPending ? t('billing.portal.opening') : t('billing.portal.managePayments')}
          </Button>
          <Button asChild variant={status === 'canceled' ? 'default' : 'outline'}>
            <Link to="../plan" relative="path">
              {status === 'canceled' ? t('billing.settings.choosePlan') : t('billing.settings.changePlan')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BillingProfileCard({ subscription }: { subscription: BillingSubscription }) {
  const { t } = useTranslation();
  const updateProfile = useUpdateBillingProfile();

  return (
    <Card data-testid="billing-profile-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('billing.profile.title')}</CardTitle>
        <CardDescription>{t('billing.profile.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <BillingProfileForm
          idPrefix="billing-profile"
          defaultValues={{
            billingCountry: subscription.billingCountry ?? '',
            vatId: subscription.vatId ?? '',
          }}
          submitLabel={t('billing.profile.save')}
          pendingLabel={t('billing.profile.saving')}
          isPending={updateProfile.isPending}
          onSubmit={(values) => updateProfile.mutate(toBillingProfileRequest(values))}
        />
      </CardContent>
    </Card>
  );
}
