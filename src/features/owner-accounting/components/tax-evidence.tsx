import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { TaxObligationEvidence } from '@/types';
import { camelCode } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';

/** The codes of the reason of a decision that the app has words for (`OwnerWithholdingRules`); another one is shown as it came. */
const KNOWN_REASONS = ['applicable', 'rule_without_withholding', 'no_collection_or_intervention', 'not_qualifying_short_let'] as const;

interface TaxEvidenceViewProps {
  evidence: TaxObligationEvidence;
  currency: string;
}

/**
 * The evidence of a withholding decision (AC-NF110-4, AC-NF110-5): applicable or not, why, on which base and rule. The figures are the ones the
 * server recorded when the payout was confirmed; the page never computes a withholding of its own. A decision that is not applicable shows no
 * amount: it is a decision with its reason, not a zero.
 */
export function TaxEvidenceView({ evidence, currency }: TaxEvidenceViewProps) {
  const { t } = useTranslation();
  const { money, date, percent } = useOwnerFormat();
  const applicable = evidence.decision === 'Applicable';
  const reason = (KNOWN_REASONS as readonly string[]).includes(evidence.reasonCode)
    ? t(`ownerAccounting.tax.reason.${camelCode(evidence.reasonCode)}`)
    : t('ownerAccounting.tax.reason.other', { code: evidence.reasonCode });

  return (
    <div className="min-w-0 space-y-1 text-sm" data-testid="tax-evidence" data-decision={evidence.decision}>
      <p className="flex flex-wrap items-center gap-2 font-medium">
        <Badge variant={applicable ? 'warning' : 'secondary'}>{applicable ? t('ownerAccounting.tax.applicable') : t('ownerAccounting.tax.notApplicable')}</Badge>
        {evidence.reversesEvidenceId ? <Badge variant="outline">{t('ownerAccounting.tax.reversal')}</Badge> : null}
      </p>
      <p className="break-words text-foreground/70">{reason}</p>
      {applicable && evidence.amount !== null ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.tax.base')}</dt>
            <dd className="tabular-nums">{evidence.grossBase !== null ? money(evidence.grossBase, currency) : '—'}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.tax.rate')}</dt>
            <dd className="tabular-nums">{evidence.ratePercent !== null ? percent(evidence.ratePercent) : '—'}</dd>
          </div>
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.tax.amount')}</dt>
            <dd className="tabular-nums" data-testid="tax-evidence-amount">
              {money(evidence.amount, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-foreground/70">{t('ownerAccounting.tax.taxCode')}</dt>
            <dd>{evidence.taxCode ?? '—'}</dd>
          </div>
        </dl>
      ) : null}
      <p className="break-words text-foreground/70">
        {t('ownerAccounting.tax.rule', { rule: evidence.ruleCode, version: evidence.ruleVersion, jurisdiction: evidence.jurisdiction })}
        {' · '}
        {t('ownerAccounting.tax.paidOn', { date: date(evidence.paidOn) })}
      </p>
    </div>
  );
}
