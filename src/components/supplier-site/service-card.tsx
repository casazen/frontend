import { useTranslation } from 'react-i18next';
import { CalendarCheck, Clock, MessageSquare } from 'lucide-react';
import type { PublicSupplierService } from '@/api/public-supplier.api';
import { formatDuration, priceUnitLabel } from '@/features/supplier/services/lib/service-labels';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { formatSlotLabel } from '@/lib/supplier-site/format';
import { SiteMedia } from './site-media';

interface ServiceCardProps {
  service: PublicSupplierService;
  /** The first slot is said only while the bookings are open. */
  showSlot: boolean;
}

/**
 * A service as the home shows it: its photo (or the fill of the trade), the name, two lines, how long it takes, the first free slot
 * and the price. "da" is always written: the supplements add to it. "IVA inclusa" only when the supplier declared it (D4): its
 * absence promises nothing.
 */
export function ServiceCard({ service, showSlot }: ServiceCardProps) {
  const { t, i18n } = useTranslation();
  const photo = service.photoUrls.find(isDisplayableMediaUrl) ?? null;
  const onQuote = service.requiresQuote || service.priceFromCents === null;
  const slot = showSlot && service.nextSlotUtc ? formatSlotLabel(service.nextSlotUtc, t, i18n.language) : '';

  return (
    <article className="vz-svc" data-testid={`supplier-site-service-${service.slug}`}>
      <SiteMedia url={photo} alt="" category={service.category} className="vz-svc__media" />
      <div className="vz-svc__body">
        <h3 className="vz-svc__title">{service.name}</h3>
        {service.summary ? <p className="vz-svc__short">{service.summary}</p> : null}
        <ul className="vz-svc__meta">
          {service.durationMinutes ? (
            <li>
              <Clock aria-hidden="true" />
              <span>{formatDuration(service.durationMinutes, t)}</span>
            </li>
          ) : null}
          {slot ? (
            <li>
              <CalendarCheck aria-hidden="true" />
              <span>{t('supplierSite.services.firstSlot', { when: slot })}</span>
            </li>
          ) : onQuote ? (
            <li>
              <MessageSquare aria-hidden="true" />
              <span>{t('supplierSite.services.quoteHint')}</span>
            </li>
          ) : null}
        </ul>
        <div className="vz-svc__foot">
          {onQuote ? (
            <p className="vz-price vz-price--quote">
              <strong>{t('supplier.services.price.onQuote')}</strong>
            </p>
          ) : (
            <p className="vz-price">
              <span className="vz-price__lead">{t('supplierSite.services.from')}</span>
              <strong>{formatMoney(service.priceFromCents ?? 0, i18n.language)}</strong>
              <small>{priceUnitLabel(service.priceUnit, t)}</small>
              {service.pricesIncludeVat ? <small className="vz-vat">{t('supplierSite.services.vatIncluded')}</small> : null}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
