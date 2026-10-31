import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, FileText } from 'lucide-react';
import type { PublicSupplierService, PublicSupplierServiceDetail } from '@/api/public-supplier.api';
import { formatDuration, formatPrice } from '@/features/supplier/services/lib/service-labels';
import { isBookable } from '@/lib/supplier-site/booking-flow';
import { buildInquiryPath } from '@/lib/supplier-site/booking-params';
import type { ServiceSelection } from '@/lib/supplier-site/service-options';
import { ServiceOptionsFields } from './service-options-fields';

interface StepServiceProps {
  supplierSlug: string;
  services: PublicSupplierService[];
  chosen: string | null;
  onChoose: (slug: string) => void;
  /** The chosen service in full (its supplements), as the server sends it. */
  detail: { service: PublicSupplierServiceDetail | undefined; isLoading: boolean; isError: boolean; onRetry: () => void };
  selection: ServiceSelection | null;
  onQuantity: (quantity: number) => void;
  onSurface: (surface: number) => void;
  onOption: (code: string, quantity: number) => void;
  /** The person went on without choosing, or the service it chose is gone. */
  problem: 'required' | null;
}

/** Step 1, "Servizio": which service, and the options that change its price. */
export function StepService({ supplierSlug, services, chosen, onChoose, detail, selection, onQuantity, onSurface, onOption, problem }: StepServiceProps) {
  const { t, i18n } = useTranslation();
  const bookable = services.filter(isBookable);
  const onQuote = services.filter((service) => !isBookable(service));

  return (
    <div className="vb-step-service">
      <fieldset className="vb-choices">
        <legend className="sr-only">{t('supplierSite.booking.service.legend')}</legend>
        {bookable.map((service) => (
          <label key={service.slug} className="vb-choice">
            <input type="radio" name="service" value={service.slug} checked={chosen === service.slug} onChange={() => onChoose(service.slug)} />
            <span className="vb-choice__in">
              <span className="vb-choice__t">
                <strong>{service.name}</strong>
                {service.summary ? <small>{service.summary}</small> : null}
              </span>
              <span className="vb-choice__p">
                <strong>{formatPrice(service, t, i18n.language)}</strong>
                <small>
                  {service.durationMinutes ? formatDuration(service.durationMinutes, t) : null}
                  {service.pricesIncludeVat ? ` · ${t('supplierSite.services.vatIncluded')}` : null}
                </small>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {problem ? (
        <p className="vb-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{t('supplierSite.booking.problems.service.required')}</span>
        </p>
      ) : null}

      {chosen && detail.isLoading ? (
        <p className="vb-note" role="status">
          {t('supplierSite.booking.service.loadingOptions')}
        </p>
      ) : null}
      {chosen && detail.isError ? (
        <div className="vb-note vb-note--warn" role="alert">
          <span>{t('supplierSite.booking.service.optionsError')}</span>
          <button type="button" className="vz-linkbtn" onClick={detail.onRetry}>
            {t('shared.errorState.retry')}
          </button>
        </div>
      ) : null}
      {detail.service && selection ? (
        <ServiceOptionsFields service={detail.service} selection={selection} onQuantity={onQuantity} onSurface={onSurface} onOption={onOption} />
      ) : null}

      {onQuote.length > 0 ? (
        <div className="vb-quote-list">
          <p className="vb-hint">{t('supplierSite.booking.service.onQuoteLead')}</p>
          <ul>
            {onQuote.map((service) => (
              <li key={service.slug}>
                <Link to={buildInquiryPath(supplierSlug, { service: service.slug })}>
                  <FileText aria-hidden="true" />
                  <span>{t('supplierSite.booking.service.onQuoteItem', { name: service.name })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
