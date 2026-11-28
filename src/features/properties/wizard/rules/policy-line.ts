import i18n from '@/i18n/config';
import type { CancellationPolicyOption } from '@/types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type PolicyNumbers = Pick<CancellationPolicyOption, 'fullRefundHours' | 'partialRefundPercent' | 'partialRefundHours'>;

function span(hours: number, t: Translate): string {
  return hours % 24 === 0
    ? t('propertyWizard.rules.policy.days', { count: hours / 24 })
    : t('propertyWizard.rules.policy.hours', { count: hours });
}

export function cancellationPolicyLine(policy: PolicyNumbers, t: Translate): string {
  const { fullRefundHours: full, partialRefundPercent: percent, partialRefundHours: partial } = policy;
  if (full <= 0) return t('propertyWizard.rules.policy.lineNone');

  const params = { full: span(full, t), percent: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(percent) };
  if (percent <= 0) return t('propertyWizard.rules.policy.lineFullOnly', params);
  if (partial <= 0) return t('propertyWizard.rules.policy.linePartialToArrival', params);
  return t('propertyWizard.rules.policy.linePartial', { ...params, partial: span(partial, t) });
}
