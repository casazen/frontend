import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarCheck, Clock, MessageSquare } from 'lucide-react';
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
  /** The page of the service: the whole card leads to it (the title is the link, stretched over the card). */
  href: string;
  /** The level of the title: 3 under the heading of a block of the home, 2 on the list of services. */
  level?: 2 | 3;
}

/**
 * A service as the home shows it: its photo (or the fill of the trade), the name, two lines, how long it takes, the first free slot
 * and the price. "da" is always written: the supplements add to it. "IVA inclusa" only when the supplier declared it (D4): its
 * absence promises nothing.
 */
export function ServiceCard({ service, showSlot, href, level = 3 }: ServiceCardProps) {
  const { t, i18n } = useTranslation();
  const Heading = level === 2 ? 'h2' : 'h3';
  const photo = service.photoUrls.find(isDisplayableMediaUrl) ?? null;
  const onQuote = service.requiresQuote || service.priceFromCents === null;
  const slot = showSlot && service.nextSlotUtc ? formatSlotLabel(service.nextSlotUtc, t, i18n.language) : '';

  return (
    <article className="vz-svc" data-testid={`supplier-site-service-${service.slug}`}>
      <SiteMedia url={photo} alt="" category={service.category} className="vz-svc__media" />
      <div className="vz-svc__body">
        <Heading className="vz-svc__title">
          <Link className="vz-stretch" to={href}>
            {service.name}
          </Link>
        </Heading>
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
          <span className="vz-svc__go" aria-hidden="true">
            <ArrowRight />
          </span>
        </div>
      </div>
    </article>
  );
}
