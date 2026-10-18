import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { LeaseConcordatoAssessment } from '@/types';

interface Props {
  assessment: LeaseConcordatoAssessment;
}

/**
 * Canone concordato range the API computed when the lease was created (LT-10, A7-12), from the declared characteristics
 * and the lease dates. With unconfirmed agreement data it is indicative and did not block the lease (A7-23).
 */
export function ConcordatoAssessmentPanel({ assessment }: Props) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('leases.concordatoAssessment.title')} data-testid="concordato-assessment">
      <div className="space-y-3 pt-2 text-sm">
        {assessment.indicative && (
          <Alert variant="warning" data-testid="concordato-assessment-indicative">
            {t('leases.concordatoAssessment.indicative')}
          </Alert>
        )}
        {!assessment.rentWithinRange && (
          <p className="text-amber-700" data-testid="concordato-assessment-outside">
            {t('leases.concordatoAssessment.rentOutside')}
          </p>
        )}
        <p>
          {t('leases.canoneConcordato.rangeMonth')}:{' '}
          <strong>
            {formatCurrency(assessment.canoneMinMensile)} – {formatCurrency(assessment.canoneMaxMensile)}
          </strong>
        </p>
        <p>
          {t('leases.canoneConcordato.rangeYear')}: {formatCurrency(assessment.canoneMinAnnuo)} –{' '}
          {formatCurrency(assessment.canoneMaxAnnuo)}
        </p>
        <p>
          {t('leases.canoneConcordato.subFascia')}: {assessment.subFascia} · {t('leases.canoneConcordato.zone')}:{' '}
          {assessment.zone}
        </p>
        <p className="text-muted-foreground">
          {t('leases.canoneConcordato.computedWith', { sqm: assessment.usableSqm, years: assessment.contractYears })}
        </p>
        <p className="text-muted-foreground">
          {t('leases.concordatoAssessment.calculatedAt', { date: formatDateTime(assessment.calculatedAt) })}
        </p>
      </div>
    </PlainSection>
  );
}
