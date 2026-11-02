import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Check, Clock, FileText, Info, Tag, X, Zap, CalendarCheck } from 'lucide-react';
import type { PublicSupplierServiceDetail } from '@/api/public-supplier.api';
import { Reveal } from '@/components/supplier-site/reveal';
import { SectionHead } from '@/components/supplier-site/section-head';
import { ServiceBookCard } from '@/components/supplier-site/service-book-card';
import { ServiceCard } from '@/components/supplier-site/service-card';
import { ServiceGallery } from '@/components/supplier-site/service-gallery';
import { useSupplierSite } from '@/components/supplier-site/site-context';
import { SiteCrumbs } from '@/components/supplier-site/site-crumbs';
import { formatDuration, priceUnitLabel, supplementUnitLabel } from '@/features/supplier/services/lib/service-labels';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { buildBookingPath, buildInquiryPath } from '@/lib/supplier-site/booking-params';
import { surfaceSupplement } from '@/lib/supplier-site/service-options';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { useSupplierService } from '@/queries/use-public-supplier';

/** The same words for a service that does not exist, one that is a draft or paused, one that is deleted and one the supplier does not show. */
function ServiceMissing({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  return (
    <div className="vz-container" data-testid="supplier-site-service-missing">
      <section className="vz-state">
        <span className="vz-state__icon" aria-hidden="true">
          <Tag />
        </span>
        <h1 tabIndex={-1}>{t('supplierSite.service.missingTitle')}</h1>
        <p>{t('supplierSite.service.missingText', { name: model.name })}</p>
        <div className="vz-state__actions">
          <Link className="vz-btn vz-btn--primary vz-btn--lg" to={supplierSitePaths.services(model.slug)}>
            {t('supplierSite.list.all')}
          </Link>
        </div>
      </section>
    </div>
  );
}

function ServiceLoading() {
  const { t } = useTranslation();
  return (
    <div className="vz-container vz-loading" role="status" aria-busy="true" data-testid="supplier-site-service-loading">
      <span className="sr-only">{t('supplierShowcase.loading')}</span>
      <div aria-hidden="true">
        <span className="vz-skel vz-skel-line vz-skel-line--title" />
        <span className="vz-skel vz-skel-hero" />
      </div>
    </div>
  );
}

/** "Come si calcola il prezzo": the catalog of the supplier as it is (the base price and each supplement), never added up here. */
function PriceExplain({ service }: { service: PublicSupplierServiceDetail }) {
  const { t, i18n } = useTranslation();
  const onQuote = service.requiresQuote || service.priceFromCents === null;
  const surface = surfaceSupplement(service);
  return (
    <section className="vd-sec" aria-labelledby="vd-price">
      <h2 id="vd-price">{t('supplierSite.service.priceTitle')}</h2>
      <dl className="vd-price">
        <div>
          <dt>{service.name}</dt>
          <dd>
            {onQuote
              ? t('supplier.services.price.onQuote')
              : `${t('supplierSite.services.from')} ${formatMoney(service.priceFromCents ?? 0, i18n.language)} ${priceUnitLabel(service.priceUnit, t)}`}
          </dd>
        </div>
        {service.supplements.map((supplement) => (
          <div key={supplement.code}>
            <dt>{supplement.label}</dt>
            <dd>
              + {formatMoney(supplement.amountCents, i18n.language)}
              <small> {supplementUnitLabel(supplement.per, t)}</small>
            </dd>
          </div>
        ))}
        {service.urgent.enabled && service.urgent.surchargeCents > 0 ? (
          <div>
            <dt>{t('supplierSite.service.urgentLine')}</dt>
            <dd>+ {formatMoney(service.urgent.surchargeCents, i18n.language)}</dd>
          </div>
        ) : null}
      </dl>
      <ul className="vd-notes">
        {surface ? (
          <li>
            <Info aria-hidden="true" />
            <span>{t('supplierSite.service.surfaceNote', { sqm: surface.includedSqm ?? 60 })}</span>
          </li>
        ) : null}
        {!onQuote ? (
          <li>
            <Info aria-hidden="true" />
            <span>{t('supplierSite.service.estimateNote')}</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** On a phone, the price and the one action stay at the bottom while the details are read. */
function ServiceBar({ model, service }: { model: SiteModel; service: PublicSupplierServiceDetail }) {
  const { t, i18n } = useTranslation();
  const onQuote = service.requiresQuote || service.priceFromCents === null;
  if (!model.bookingsOpen) return null;
  return (
    <div className="vz-stickybar is-on" data-testid="supplier-site-service-bar">
      <div className="vz-stickybar__price">
        <strong>{onQuote ? t('supplier.services.price.onQuote') : `${t('supplierSite.services.from')} ${formatMoney(service.priceFromCents ?? 0, i18n.language)}`}</strong>
        {onQuote ? null : <span>{priceUnitLabel(service.priceUnit, t)}</span>}
      </div>
      {onQuote ? (
        <Link className="vz-btn vz-btn--primary" to={buildInquiryPath(model.slug, { service: service.slug })}>
          <FileText aria-hidden="true" />
          <span>{t('supplierSite.cta.inquiry')}</span>
        </Link>
      ) : (
        <Link className="vz-btn vz-btn--primary" to={buildBookingPath(model.slug, { service: service.slug })}>
          <CalendarCheck aria-hidden="true" />
          <span>{t('supplierSite.service.bookShort')}</span>
        </Link>
      )}
    </div>
  );
}

/**
 * One service of the supplier, `/fornitori/:slug/servizi/:serviceSlug` (SP-09-FE-b): the photos, what it is, what is and is not
 * included, how the price is made, what to do before the supplier arrives and the questions it answered, with the card of the booking
 * beside it (the estimate follows the options). Only a service the supplier shows; anything else is the same "not found".
 */
export function SupplierServicePage() {
  const { t } = useTranslation();
  const { model } = useSupplierSite();
  const { serviceSlug = '' } = useParams<{ serviceSlug: string }>();
  const listed = model.services?.find((candidate) => candidate.slug === serviceSlug);
  const { data: service, isLoading, isError, error, refetch } = useSupplierService(model.slug, serviceSlug, !!listed);

  // Without the list of services (the bookings flag is off) there is no service to show.
  if (model.services === null) return <Navigate to={supplierSitePaths.home(model.slug)} replace />;
  if (!listed) return <ServiceMissing model={model} />;
  if (isLoading) return <ServiceLoading />;
  if (isError && isAxiosError(error) && error.response?.status === 404) return <ServiceMissing model={model} />;
  if (isError || !service) {
    return (
      <div className="vz-container" role="alert" data-testid="supplier-site-service-error">
        <section className="vz-state vz-state--error">
          <h1 tabIndex={-1}>{t('supplierSite.service.loadError')}</h1>
          <div className="vz-state__actions">
            <button type="button" className="vz-btn vz-btn--primary vz-btn--lg" onClick={() => void refetch()}>
              {t('shared.errorState.retry')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const photos = service.photoUrls.filter(isDisplayableMediaUrl);
  const others = model.services.filter((candidate) => candidate.slug !== service.slug).slice(0, 3);
  const onQuote = service.requiresQuote || service.priceFromCents === null;

  return (
    <div data-testid="supplier-site-service-page" className={model.bookingsOpen ? 'vd-has-bar' : undefined}>
      <section className="vd-top">
        <div className="vz-container">
          <SiteCrumbs slug={model.slug} items={[{ label: t('supplierSite.nav.services'), to: supplierSitePaths.services(model.slug) }, { label: service.name }]} />
          <div className="vd-title">
            <h1 id="vz-title" tabIndex={-1}>
              {service.name}
            </h1>
            {service.summary ? <p className="vd-lead">{service.summary}</p> : null}
          </div>
          <ServiceGallery photos={photos} name={service.name} category={service.category} />
        </div>
      </section>

      <div className="vz-container vd-cols">
        <div className="vd-main">
          <section className="vd-sec" aria-labelledby="vd-about">
            <h2 id="vd-about">{t('supplierSite.service.aboutTitle')}</h2>
            {service.description ? <p className="vd-desc">{service.description}</p> : null}
            <ul className="vd-facts">
              {service.durationMinutes ? (
                <li>
                  <Clock aria-hidden="true" />
                  <span>{formatDuration(service.durationMinutes, t)}</span>
                </li>
              ) : null}
              {onQuote ? (
                <li>
                  <FileText aria-hidden="true" />
                  <span>{t('supplierSite.service.quoteFact')}</span>
                </li>
              ) : null}
              {service.urgent.enabled ? (
                <li>
                  <Zap aria-hidden="true" />
                  <span>{t('supplierSite.service.urgentFact')}</span>
                </li>
              ) : null}
            </ul>
          </section>

          {service.included.length > 0 || service.excluded.length > 0 ? (
            <section className="vd-sec" aria-labelledby="vd-inc">
              <h2 id="vd-inc">{t('supplierSite.service.includedTitle')}</h2>
              <div className="vd-inc">
                {service.included.length > 0 ? (
                  <div className="vd-inc__col">
                    <h3>
                      <Check aria-hidden="true" />
                      {t('supplierSite.service.included')}
                    </h3>
                    <ul>
                      {service.included.map((item) => (
                        <li key={item}>
                          <Check aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {service.excluded.length > 0 ? (
                  <div className="vd-inc__col vd-inc__col--no">
                    <h3>
                      <X aria-hidden="true" />
                      {t('supplierSite.service.excluded')}
                    </h3>
                    <ul>
                      {service.excluded.map((item) => (
                        <li key={item}>
                          <X aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <PriceExplain service={service} />

          {model.prep.length > 0 ? (
            <section className="vd-sec" aria-labelledby="vd-prep">
              <h2 id="vd-prep">{t('supplierSite.service.prepTitle')}</h2>
              <ul className="vd-prep">
                {model.prep.map((item) => (
                  <li key={item}>
                    <Check aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {model.faq.length > 0 ? (
            <section className="vd-sec" aria-labelledby="vd-faq">
              <h2 id="vd-faq">{t('supplierSite.service.faqTitle')}</h2>
              <div className="vz-faq">
                {model.faq.map((row) => (
                  <details key={row.question} className="vz-faq__item">
                    <summary>{row.question}</summary>
                    <div className="vz-faq__a">
                      <p>{row.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <div className="vd-side">
          <ServiceBookCard model={model} service={service} />
        </div>
      </div>

      {others.length > 0 ? (
        <section className="vz-section vz-section--tint" aria-labelledby="vd-others">
          <div className="vz-container">
            <SectionHead id="vd-others" eyebrow={t('supplierSite.service.othersEyebrow')} title={t('supplierSite.service.othersTitle')} />
            <div className="vz-grid">
              {others.map((other, index) => (
                <Reveal key={other.slug} index={index}>
                  <ServiceCard service={other} showSlot={model.bookingsOpen} href={supplierSitePaths.service(model.slug, other.slug)} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <ServiceBar model={model} service={service} />
    </div>
  );
}
