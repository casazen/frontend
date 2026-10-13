import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card data-testid="concordato-assessment">
      <CardHeader>
        <CardTitle>{t('leases.concordatoAssessment.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {assessment.indicative && (
          <div
            role="status"
            data-testid="concordato-assessment-indicative"
            className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>{t('leases.concordatoAssessment.indicative')}</span>
          </div>
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
      </CardContent>
    </Card>
  );
}
