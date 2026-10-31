import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Clock } from 'lucide-react';
import type { PublicAlternative } from '@/api/public-supplier-booking.api';
import { priceUnitLabel } from '@/features/supplier/services/lib/service-labels';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { formatTypicalResponse } from '@/lib/supplier-site/format';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { SiteMedia } from '../site-media';

/** One professional of the list: the cover, the name (the link to its showcase), «Verificato», how long it usually takes to answer, and a «da €». */
function AlternativeCard({ alternative }: { alternative: PublicAlternative }) {
  const { t, i18n } = useTranslation();
  const cover = isDisplayableMediaUrl(alternative.coverUrl) ? alternative.coverUrl : null;
  const service = alternative.service ?? null;
  const from = service && !service.requiresQuote && typeof service.fromPriceCents === 'number' ? service.fromPriceCents : null;
  return (
    <article className="vi-alt__card" data-testid={`supplier-request-alternative-${alternative.slug}`}>
      <SiteMedia url={cover} alt={alternative.coverAlt ?? ''} className="vi-alt__media" />
      <div className="vi-alt__body">
        <h3 className="vi-alt__name">
          <Link className="vz-stretch" to={supplierSitePaths.home(alternative.slug)}>
            {alternative.name}
          </Link>
        </h3>
        <ul className="vi-alt__meta">
          {alternative.verified ? (
            <li>
              <BadgeCheck aria-hidden="true" />
              <span>{t('supplierSite.trust.verified')}</span>
            </li>
          ) : null}
          {alternative.medianResponseMinutes ? (
            <li>
              <Clock aria-hidden="true" />
              <span>{t('supplierSite.inquiry.alternatives.typical', { typical: formatTypicalResponse(alternative.medianResponseMinutes, t) })}</span>
            </li>
          ) : null}
        </ul>
        {service ? (
          <p className="vi-alt__service">
            <span>{service.name}</span>
            {from !== null ? (
              <span className="vi-alt__price">
                {t('supplierSite.services.from')} <strong>{formatMoney(from, i18n.language)}</strong> <small>{priceUnitLabel(service.priceUnit, t)}</small>
              </span>
            ) : (
              <span className="vi-alt__price">{t('supplier.services.price.onQuote')}</span>
            )}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * «Altri professionisti per te» (SP-10c, SP-12c): up to three professionals the server offers to the customer of a request CasaZen closed
 * because the supplier did not answer in time. Nothing is said that the server did not give: an empty list is said plainly, with no
 * promise of a call back, and no contact of anybody is shown (there is none in the answer).
 */
export function Alternatives({ alternatives }: { alternatives: PublicAlternative[] }) {
  const { t } = useTranslation();
  return (
    <section className="vz-section vz-section--tight vi-alt" aria-labelledby="vi-alt-title" data-testid="supplier-request-alternatives">
      <div className="vz-container">
        <h2 id="vi-alt-title" className="vf-h2">
          {t('supplierSite.inquiry.alternatives.title')}
        </h2>
        {alternatives.length === 0 ? (
          <p className="vf-p" data-testid="supplier-request-alternatives-none">
            {t('supplierSite.inquiry.alternatives.none')}
          </p>
        ) : (
          <>
            <p className="vf-p">{t('supplierSite.inquiry.alternatives.lead')}</p>
            <ul className="vi-alt__list">
              {alternatives.slice(0, 3).map((alternative) => (
                <li key={alternative.slug}>
                  <AlternativeCard alternative={alternative} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
