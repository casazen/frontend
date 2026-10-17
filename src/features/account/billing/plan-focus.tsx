import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction, type CalmTone } from '@/components/shared/calm';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { HelpTip } from '@/components/ui/help-tip';
import { formatBillingDate, needsPaymentAction } from '@/features/billing/billing-utils';
import { getPlanTierLabel } from '@/lib/i18n-labels';
import type { BillingSubscription, BillingSubscriptionStatus, PlanTier } from '@/types';
import {
  nextChargeAt,
  pickPlanNotice,
  pickPlanPrimary,
  type Meter,
  type PlanNotice,
  type PlanPrimary,
  type PlanUsage,
  type PortalHandle,
} from './account-billing-model';

const DASH = '—';

// The words of a payment that is not settled are the ones the plan pages have always had (`billing.notice.*`).
const PAYMENT_NOTICE: Partial<Record<BillingSubscriptionStatus, string>> = {
  past_due: 'billing.notice.pastDue',
  incomplete: 'billing.notice.incomplete',
  unpaid: 'billing.notice.unpaid',
};

const PLAN_NOTICE: Record<PlanNotice, string> = {
  openAccess: 'accountBilling.plan.notice.openAccess',
  openAccessPricesPending: 'accountBilling.plan.notice.openAccessPricesPending',
  pricesPending: 'accountBilling.plan.notice.pricesPending',
};

const PRIMARY_LABEL: Record<Exclude<PlanPrimary, 'fixPayment'>, string> = {
  change: 'accountBilling.plan.change',
  choose: 'accountBilling.plan.choose',
  view: 'accountBilling.plan.view',
};

function usageText(meter: Meter, t: TFunction): string {
  return meter.max === null
    ? t('accountBilling.plan.unlimited', { used: meter.used })
    : t('accountBilling.plan.usage', { used: meter.used, max: meter.max });
}

function Figure({ label, value, help, testId }: { label: string; value: string; help?: ReactNode; testId: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-sm text-foreground/70">
        <span className="min-w-0 break-words">{label}</span>
        {help}
      </dt>
      <dd data-testid={testId} className="mt-0.5 break-words text-lg font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

interface PlanFocusProps {
  subscription: BillingSubscription;
  /** The plan the page calls the person's own (see `pickShownTier`). */
  tier: PlanTier;
  usage: PlanUsage;
  openAccess: boolean;
  pricesPending: boolean;
  /** Opens the comparison of the plans. */
  onOpenPlans: () => void;
  portal: PortalHandle;
}

/**
 * The one highlighted block of the page: the plan of the org with what it is used for (properties and people out of what it includes),
 * when the next charge is, and the one thing to do about it. The tone is the news: neutral while all is well, a warning or a danger
 * while a payment is not settled (and then the button leads to the payment, not to the plans). The open access and the prices that
 * are not defined yet are a sentence in it, one at a time, never a second colored box.
 */
export function PlanFocus({ subscription, tier, usage, openAccess, pricesPending, onOpenPlans, portal }: PlanFocusProps) {
  const { t, i18n } = useTranslation();
  const { status } = subscription;

  const tone: CalmTone = !needsPaymentAction(status) ? 'neutral' : status === 'unpaid' ? 'danger' : 'warning';
  const paymentKey = PAYMENT_NOTICE[status];
  const planNotice = pickPlanNotice(openAccess, pricesPending);
  // A payment to settle comes first; then what the person should know about the open access or the prices; an ended subscription last.
  const notice = paymentKey
    ? t(paymentKey)
    : planNotice
      ? t(PLAN_NOTICE[planNotice])
      : status === 'canceled'
        ? t('billing.notice.canceled')
        : null;

  const primaryKind = pickPlanPrimary(status, pricesPending);
  const primary: CalmAction =
    primaryKind === 'fixPayment'
      ? { label: t('billing.portal.completePayment'), onClick: portal.open, loading: portal.pending, testId: 'account-billing-primary' }
      : { label: t(PRIMARY_LABEL[primaryKind]), onClick: onOpenPlans, testId: 'account-billing-primary' };

  const charge = nextChargeAt(subscription);
  const chargeText = charge
    ? formatBillingDate(charge, i18n.language) || DASH
    : status === 'none' || status === 'canceled'
      ? t('accountBilling.plan.noCharge')
      : DASH;

  return (
    <FocusBlock
      data-testid="account-billing-plan"
      tone={tone}
      kicker={t('accountBilling.plan.kicker')}
      title={t('accountBilling.plan.title', { plan: getPlanTierLabel(tier, t) })}
      primary={primary}
      body={
        <div className="space-y-4">
          {status !== 'none' ? (
            <div>
              <StatusBadge kind="subscription" status={status} />
            </div>
          ) : null}
          {notice ? <p data-testid="account-billing-notice">{notice}</p> : null}
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
            {usage.properties ? (
              <Figure testId="account-billing-properties" label={t('accountBilling.plan.properties')} value={usageText(usage.properties, t)} />
            ) : null}
            {usage.seats ? (
              <Figure
                testId="account-billing-people"
                label={t('accountBilling.plan.people')}
                value={usageText(usage.seats, t)}
                help={<HelpTip title={t('accountBilling.plan.peopleHelpTitle')}>{t('accountBilling.plan.peopleHelp')}</HelpTip>}
              />
            ) : null}
            <Figure testId="account-billing-next-charge" label={t('accountBilling.plan.nextCharge')} value={chargeText} />
          </dl>
        </div>
      }
    />
  );
}
