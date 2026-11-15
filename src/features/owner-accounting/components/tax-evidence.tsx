import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { F24_CURRENCY } from '@/lib/agency-finance';
import type { TaxObligationEvidence } from '@/types';
import { decisionReasonWords } from '../payout-facts-model';
import { useOwnerFormat } from '../use-owner-format';
import { PayoutFactsView } from './payout-facts-view';

const NO_NAMES: ReadonlyMap<string, string> = new Map();

interface TaxEvidenceViewProps {
  evidence: TaxObligationEvidence;
  /** The names of the properties of the agency, by id: the facts of a stay carry the id only. */
  propertyNames?: ReadonlyMap<string, string>;
}

/**
 * The evidence of a withholding decision (AC-NF110-4, AC-NF110-5): applicable or not, why, on which base and rule, and the facts of the ledger it was taken on. The figures are the ones the server recorded when the
 * payout was confirmed; the page never computes a withholding of its own. A decision that is not applicable shows no amount: it is a decision with its reason, not a zero. The base and the amount are in euro,
 * the currency of the F24, whatever the currency the owner is paid in (the facts say it; a decision of before the facts were read from the ledger is in euro too): the amount kept from a payout in another currency
 * is on the payout, in its own currency.
 */
export function TaxEvidenceView({ evidence, propertyNames = NO_NAMES }: TaxEvidenceViewProps) {
  const { t } = useTranslation();
  const { money, date, percent } = useOwnerFormat();
  const applicable = evidence.decision === 'Applicable';
  const currency = evidence.facts?.withholdingCurrency || F24_CURRENCY;
  const facts = evidence.facts && evidence.facts.stays.length > 0 ? evidence.facts : null;

  return (
    <div className="min-w-0 space-y-1 text-sm" data-testid="tax-evidence" data-decision={evidence.decision}>
      <p className="flex flex-wrap items-center gap-2 font-medium">
        <Badge variant={applicable ? 'warning' : 'secondary'}>{applicable ? t('ownerAccounting.tax.applicable') : t('ownerAccounting.tax.notApplicable')}</Badge>
        {evidence.reversesEvidenceId ? <Badge variant="outline">{t('ownerAccounting.tax.reversal')}</Badge> : null}
      </p>
      <p className="break-words text-foreground/70">{decisionReasonWords(t, evidence.reasonCode)}</p>
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
      {facts ? (
        <details className="group min-w-0 pt-1" data-testid="tax-evidence-facts">
          <summary className="flex min-h-11 cursor-pointer list-none items-center font-medium text-primary underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            {t('ownerAccounting.facts.summary', { count: facts.stays.length })}
          </summary>
          <div className="pb-2">
            <PayoutFactsView facts={facts} propertyNames={propertyNames} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
