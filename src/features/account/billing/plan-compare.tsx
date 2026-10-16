import { useState, type Ref } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { CheckoutDialog } from '@/features/billing/components/checkout-dialog';
import { isLiveSubscription, needsPaymentAction } from '@/features/billing/billing-utils';
import type { BillingPlan, BillingSubscription, PlanTier } from '@/types';
import {
  arePricesPending,
  formatPlanPrice,
  pickPlanAction,
  planPrice,
  propertiesOverAllowance,
  type PlanAction,
  type PlanUsage,
  type PortalHandle,
} from './account-billing-model';
import { BillingDisclosure } from './billing-disclosure';

// A long label wraps instead of pushing the page sideways, and the button is at least 44 px high (as the calm blocks do).
const WRAPPING_BUTTON = 'h-auto min-h-11 w-full whitespace-normal py-2 text-center leading-tight';

interface PlanRowProps {
  plan: BillingPlan;
  action: PlanAction;
  /** Properties the org has now, to say what going down to this plan would mean. */
  properties: number | undefined;
  /** Tells why a plan cannot be bought, unless the page has already said that no plan can. */
  showUnavailableHint: boolean;
  portal: PortalHandle;
  onChoose: () => void;
}

function PlanRow({ plan, action, properties, showUnavailableHint, portal, onChoose }: PlanRowProps) {
  const { t, i18n } = useTranslation();
  const price = planPrice(plan);
  const over = action === 'current' ? null : propertiesOverAllowance(plan, properties);

  // An amount only when there is one (AM-D28): never a zero that nobody set, never an amount for a plan that cannot be bought.
  const priceText =
    price !== null
      ? t('accountBilling.compare.price', { price: formatPlanPrice(price, plan.currency, i18n.language) })
      : plan.purchasable
        ? t('billing.plans.priceAtCheckout')
        : t('accountBilling.compare.priceTbd');

  return (
    <li
      data-testid={`plan-card-${plan.tier}`}
      aria-current={action === 'current' ? 'true' : undefined}
      className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start sm:gap-6"
    >
      <div className="min-w-0 space-y-1.5">
        <h3 className="flex flex-wrap items-center gap-x-2 break-words font-semibold">
          {plan.displayName}
          {action === 'current' ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground/70">
              <Check aria-hidden="true" className="size-4" />
              {t('accountBilling.compare.current')}
            </span>
          ) : null}
        </h3>
        <p data-testid={`plan-price-${plan.tier}`} className="break-words text-sm">
          {priceText}
        </p>
        <p className="break-words text-sm text-foreground/70">
          {plan.unitAllowance < 0
            ? t('accountBilling.compare.propertiesUnlimited')
            : t('accountBilling.compare.properties', { count: plan.unitAllowance })}
        </p>
        {plan.features.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="break-words">
                {feature}
              </li>
            ))}
          </ul>
        ) : null}
        {over !== null ? (
          <p className="break-words text-sm font-medium">{t('accountBilling.compare.overLimit', { count: over, allowance: plan.unitAllowance })}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {action === 'current' ? (
          <Button type="button" variant="secondary" className={WRAPPING_BUTTON} disabled>
            {t('plan.currentPlan')}
          </Button>
        ) : null}
        {action === 'checkout' ? (
          <Button type="button" className={WRAPPING_BUTTON} onClick={onChoose}>
            {t('plan.choosePlan')}
          </Button>
        ) : null}
        {action === 'portal' ? (
          <Button type="button" variant="outline" className={WRAPPING_BUTTON} onClick={portal.open} disabled={portal.pending}>
            {t('billing.plans.changeInPortal')}
          </Button>
        ) : null}
        {action === 'unavailable' ? (
          <>
            <Button type="button" variant="outline" className={WRAPPING_BUTTON} disabled>
              {t('billing.plans.unavailable')}
            </Button>
            {showUnavailableHint ? <p className="text-sm text-foreground/70">{t('billing.plans.unavailableHint')}</p> : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

interface PlanCompareProps {
  detailsRef: Ref<HTMLDetailsElement>;
  plansQuery: UseQueryResult<BillingPlan[]>;
  subscription: BillingSubscription;
  /** The plan the page calls the person's own (see `pickShownTier`). */
  tier: PlanTier;
  usage: PlanUsage;
  portal: PortalHandle;
  /** The backend says the org already has a subscription: the page reads it again, and the plans lead to the portal. */
  onAlreadySubscribed: () => void;
}

/**
 * "Confronta i piani": the plans of the catalog one under the other, the person's own marked, each with what it costs (only when
 * the price is known and the plan can be bought), how many properties it includes, and what going down to it means. The change is
 * the one the plan pages have always had: with a subscription the Stripe portal, without one the checkout (country and VAT number,
 * then Stripe). It opens from the button of the plan block.
 */
export function PlanCompare({ detailsRef, plansQuery, subscription, tier, usage, portal, onAlreadySubscribed }: PlanCompareProps) {
  const { t } = useTranslation();
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlan | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const { status } = subscription;
  const plans = plansQuery.data;
  const pricesPending = arePricesPending(plans, status);

  const handleAlreadySubscribed = () => {
    setCheckoutPlan(null);
    setAlreadySubscribed(true);
    onAlreadySubscribed();
  };

  const renderPlans = () => {
    if (plansQuery.isPending) {
      return (
        <div data-testid="billing-plans-loading">
          <SkeletonLine lines={4} label={t('accountBilling.loading')} />
        </div>
      );
    }
    if (plansQuery.isError || !plans) {
      return (
        <div role="alert" data-testid="billing-plans-error" className="space-y-3 text-sm">
          <p className="text-destructive">{t('billing.plans.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void plansQuery.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        </div>
      );
    }
    if (plans.length === 0) {
      return (
        <div data-testid="billing-plans-empty" className="space-y-1 text-sm">
          <p className="font-medium">{t('billing.plans.emptyTitle')}</p>
          <p className="text-foreground/70">{t('billing.plans.emptyDescription')}</p>
        </div>
      );
    }
    return (
      <ul role="list" data-testid="billing-plans-grid" className="divide-y divide-border">
        {plans.map((plan) => (
          <PlanRow
            key={plan.tier}
            plan={plan}
            action={pickPlanAction(plan, tier, status)}
            properties={usage.properties?.used}
            showUnavailableHint={!pricesPending}
            portal={portal}
            onChoose={() => {
              setAlreadySubscribed(false);
              setCheckoutPlan(plan);
            }}
          />
        ))}
      </ul>
    );
  };

  return (
    <BillingDisclosure
      detailsRef={detailsRef}
      testId="account-billing-compare"
      title={t('accountBilling.compare.title')}
      summary={plans && plans.length > 0 ? plans.map((plan) => plan.displayName).join(' · ') : undefined}
    >
      {alreadySubscribed ? (
        <div role="alert" data-testid="already-subscribed-alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <p className="min-w-0 break-words">{t('apiErrors.codes.alreadySubscribed')}</p>
          <Button type="button" size="sm" onClick={portal.open} disabled={portal.pending}>
            {portal.pending ? t('billing.portal.opening') : t('billing.portal.open')}
          </Button>
        </div>
      ) : null}
      {isLiveSubscription(status) && !needsPaymentAction(status) && !alreadySubscribed ? (
        <p data-testid="live-subscription-notice" className="break-words text-sm">
          {t('billing.plans.liveSubscription')}
        </p>
      ) : null}

      {renderPlans()}

      <p className="break-words text-sm text-foreground/70">{t('accountBilling.compare.note')}</p>

      <CheckoutDialog plan={checkoutPlan} subscription={subscription} onClose={() => setCheckoutPlan(null)} onAlreadySubscribed={handleAlreadySubscribed} />
    </BillingDisclosure>
  );
}
