import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { getStatusView } from '@/components/shared/status/status-view';
import type { BillingSubscriptionStatus } from '@/types';
import { BillingDisclosure } from './billing-disclosure';

/** The states a subscription goes through, in the order a person meets them; "no subscription" is the state before all of them. */
const LISTED: readonly BillingSubscriptionStatus[] = ['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'canceled'];

/**
 * "Cosa significano gli stati dell'abbonamento": each state with the sentence of the status dictionary (the same words the badge and
 * the explainers of the app use), the one the org is in marked.
 */
export function SubscriptionStates({ status }: { status: BillingSubscriptionStatus }) {
  const { t, i18n } = useTranslation();
  const current = getStatusView('subscription', status, 'host', t, i18n).label;
  const rows = LISTED.map((state) => ({ state, explain: getStatusView('subscription', state, 'host', t, i18n).explain }));

  return (
    <BillingDisclosure
      testId="account-billing-states"
      title={t('accountBilling.states.title')}
      summary={t('accountBilling.states.now', { status: current })}
    >
      <ul role="list" className="space-y-3">
        {rows.map(({ state, explain }) => (
          <li key={state} aria-current={state === status ? 'true' : undefined} className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
            <span className="sm:w-52 sm:shrink-0">
              <StatusBadge kind="subscription" status={state} />
            </span>
            <span className="min-w-0 break-words text-sm text-foreground/70">{explain}</span>
          </li>
        ))}
      </ul>
    </BillingDisclosure>
  );
}
