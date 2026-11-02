import i18n from '@/i18n/config';
import type { CancellationPolicyOption } from '@/types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type PolicyNumbers = Pick<CancellationPolicyOption, 'fullRefundHours' | 'partialRefundPercent' | 'partialRefundHours'>;

/** A span of hours as people count it: whole days as «5 giorni», anything else as hours. */
function span(hours: number, t: Translate): string {
  return hours % 24 === 0
    ? t('propertyWizard.rules.policy.days', { count: hours / 24 })
    : t('propertyWizard.rules.policy.hours', { count: hours });
}

/**
 * What a cancellation policy of the catalog does, said **only by its three numbers** and in the way the refund is calculated: the
 * whole stay is refunded when the guest cancels at least `fullRefundHours` before the arrival, `partialRefundPercent` of it when at
 * least `partialRefundHours` before, nothing after. No word of the catalog's own description is used (SR-D40: some of those texts
 * promise nights kept that the calculation does not apply), so what the host reads is what the guest gets back.
 */
export function cancellationPolicyLine(policy: PolicyNumbers, t: Translate): string {
  const { fullRefundHours: full, partialRefundPercent: percent, partialRefundHours: partial } = policy;
  if (full <= 0) return t('propertyWizard.rules.policy.lineNone');

  const params = { full: span(full, t), percent: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(percent) };
  if (percent <= 0) return t('propertyWizard.rules.policy.lineFullOnly', params);
  if (partial <= 0) return t('propertyWizard.rules.policy.linePartialToArrival', params);
  return t('propertyWizard.rules.policy.linePartial', { ...params, partial: span(partial, t) });
}
