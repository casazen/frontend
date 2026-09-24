import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { ActivationTouristTax } from '@/types/compliance.types';

interface TouristTaxStepInfoProps {
  /** Tourist tax info of the `tourist-tax` step; missing when the API did not send it. */
  touristTax: ActivationTouristTax | null | undefined;
  /** City of the property, used when the step carries no info. */
  city: string;
}

/**
 * Tourist tax step of the activation wizard (A5-06, A8-28): the rate of the host's comune when CasaZen knows it,
 * otherwise a non-blocking warning. Links the public page of the comune when it exists; never an admin route.
 */
export function TouristTaxStepInfo({ touristTax, city }: TouristTaxStepInfoProps) {
  const { t } = useTranslation();
  const comune = touristTax?.city || city;
  const rate = touristTax?.rate ?? null;
  const publicPageSlug = touristTax?.publicPageSlug ?? null;

  return (
    <div className="space-y-4" data-testid="activation-tourist-tax">
      {rate ? (
        <div className="space-y-3 rounded-md border p-4 text-sm" data-testid="activation-tourist-tax-rate">
          <p className="font-medium">{t('compliance.activation.touristTax.rateTitle', { city: comune })}</p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <dt className="text-muted-foreground">{t('compliance.activation.touristTax.amount')}</dt>
            <dd className="font-medium">{formatCurrency(rate.ratePerPersonPerNight)}</dd>
            <dt className="text-muted-foreground">{t('compliance.activation.touristTax.maxNights')}</dt>
            <dd>{rate.maxNights ?? t('compliance.activation.touristTax.noMaxNights')}</dd>
            <dt className="text-muted-foreground">{t('compliance.activation.touristTax.exemption')}</dt>
            <dd>
              {rate.minimumAge > 0
                ? t('compliance.activation.touristTax.exemptUnder', { count: rate.minimumAge })
                : t('compliance.activation.touristTax.noAgeExemption')}
            </dd>
            <dt className="text-muted-foreground">{t('compliance.activation.touristTax.effectiveFrom')}</dt>
            <dd>{formatDate(rate.effectiveFrom.slice(0, 10))}</dd>
          </dl>
          {rate.sourceUrl && (
            <a
              href={rate.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid="activation-tourist-tax-source"
            >
              {t('compliance.activation.touristTax.source')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <p className="text-muted-foreground">{t('compliance.activation.touristTax.disclaimer')}</p>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          data-testid="activation-tourist-tax-missing"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="font-medium">
              {comune
                ? t('compliance.activation.touristTax.missingTitle', { city: comune })
                : t('compliance.activation.touristTax.cityMissing')}
            </p>
            <p>{t('compliance.activation.touristTax.missingHint')}</p>
          </div>
        </div>
      )}

      {publicPageSlug && (
        <Link
          to={`/p/tassa-soggiorno/${encodeURIComponent(publicPageSlug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          data-testid="activation-tourist-tax-public-page"
        >
          {t('compliance.activation.touristTax.publicPage', { city: comune })}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
