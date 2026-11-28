import type { TFunction } from 'i18next';
import type { RegimeOutcome } from './guide-answers';
import { formatWholeEuro } from './guide-format';

export const IRPEF_REASONS = [
  'not_configured',
  'brackets_outdated',
  'income_over_limit',
  'concordato_ata_relief_not_verified',
];

export function describeRegimeOutcome(outcome: RegimeOutcome, t: TFunction): { sentence: string; detail: string | null } {
  switch (outcome.kind) {
    case 'cedolareCheaper':
      return { sentence: t('leaseGuide.regime.outcome.cedolareCheaper', { amount: formatWholeEuro(outcome.amount) }), detail: null };
    case 'ordinaryCheaper':
      return { sentence: t('leaseGuide.regime.outcome.ordinaryCheaper', { amount: formatWholeEuro(outcome.amount) }), detail: null };
    case 'equal':
      return { sentence: t('leaseGuide.regime.outcome.equal'), detail: null };
    case 'incomeNeeded':
      return { sentence: t('leaseGuide.regime.outcome.unknown'), detail: t('leaseGuide.regime.outcome.incomeNeeded') };
    case 'notComputed':
      return {
        sentence: t('leaseGuide.regime.outcome.unknown'),
        detail:
          outcome.reasonCode && IRPEF_REASONS.includes(outcome.reasonCode)
            ? t(`leases.rli.advisory.ordinary.irpefReason.${outcome.reasonCode}`, { year: outcome.year })
            : t('leases.rli.advisory.ordinary.irpefToAssess'),
      };
  }
}
