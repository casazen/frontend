import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/utils';
import type { LeaseDetail } from '@/types';
import { CanoneConcordatoCalculator } from '../components/canone-concordato-calculator';
import { ConcordatoAssessmentPanel } from '../components/concordato-assessment-panel';
import { Disclosure } from './disclosure';
import { storedRentAnswer } from './guide-answers';

export function ConcordatoRangeCheck({ lease }: { lease: LeaseDetail }) {
  const { t } = useTranslation();
  const assessment = lease.concordatoAssessment;
  const stored = storedRentAnswer(assessment, lease.monthlyRent);

  const calculator = (
    <CanoneConcordatoCalculator
      propertyId={lease.propertyId}
      startDate={lease.startDate}
      endDate={lease.endDate}
      initial={assessment}
      rent={lease.monthlyRent}
    />
  );

  return (
    <div className="space-y-4 text-sm" data-testid="rent-range-check">
      {stored && assessment ? (
        <>
          <div className="space-y-1" data-testid="rent-range-stored" data-place={stored.place}>
            <p className="text-base font-semibold leading-snug">
              {t(`leaseGuide.rent.answer.${stored.place}`, {
                rent: formatCurrency(lease.monthlyRent),
                min: formatCurrency(stored.min),
                max: formatCurrency(stored.max),
              })}
            </p>
            {stored.indicative && <p className="text-foreground/70">{t('leaseGuide.rent.indicative')}</p>}
          </div>
          <Disclosure summary={t('leaseGuide.rent.how')} testId="rent-range-how">
            <ConcordatoAssessmentPanel assessment={assessment} />
          </Disclosure>
          <Disclosure summary={t('leaseGuide.rent.recalc')} testId="rent-range-recalc">
            {calculator}
          </Disclosure>
        </>
      ) : (
        <>
          <p>{t('leaseGuide.rent.intro')}</p>
          {calculator}
        </>
      )}
      <p className="text-foreground/70">{t('leaseGuide.rent.associations')}</p>
    </div>
  );
}
