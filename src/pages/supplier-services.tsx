import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, ListFilter, RotateCcw } from 'lucide-react';
import { Reveal } from '@/components/supplier-site/reveal';
import { ServiceCard } from '@/components/supplier-site/service-card';
import { useSupplierSite } from '@/components/supplier-site/site-context';
import { SiteCrumbs } from '@/components/supplier-site/site-crumbs';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { buildInquiryPath } from '@/lib/supplier-site/booking-params';
import { PRICE_KINDS, SERVICE_SORTS, viewOfServices } from '@/lib/supplier-site/service-list';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';

/**
 * All the services of the supplier, `/fornitori/:slug/servizi` (SP-09-FE-b): the category as chips, the kind of price and the order as
 * selects, all in the address (`?cat=&price=&sort=`) so they can be shared; the chips are links and work without script. The count is
 * announced; an empty answer says why and how to take the filters off. No filter for urgent services (left out on purpose).
 */
export function SupplierServicesPage() {
  const { t } = useTranslation();
  const { model } = useSupplierSite();
  const [params, setParams] = useSearchParams();

  // Without the list of services (the bookings flag is off) there is nothing to list.
  if (model.services === null) return <Navigate to={supplierSitePaths.home(model.slug)} replace />;

  const view = viewOfServices(model.services, { cat: params.get('cat'), price: params.get('price'), sort: params.get('sort') });
  const filtered = view.list.length !== model.services.length;
  const base = supplierSitePaths.services(model.slug);

  /** The address with one choice changed (null takes it off); the others stay. */
  const withChoice = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return next;
  };
  const href = (patch: Record<string, string | null>) => {
    const search = withChoice(patch).toString();
    return search ? `${base}?${search}` : base;
  };

  return (
    <div data-testid="supplier-site-services-page">
      <section className="vl-head">
        <div className="vz-container">
          <SiteCrumbs slug={model.slug} items={[{ label: t('supplierSite.nav.services') }]} />
          <p className="vz-eyebrow">{t('supplierSite.services.eyebrow')}</p>
          <h1 id="vz-title" tabIndex={-1}>
            {t('supplierSite.list.title', { name: model.name })}
          </h1>
          <p className="vl-head__lead">{model.bookingsOpen ? t('supplierSite.list.leadOpen') : t('supplierSite.list.leadClosed')}</p>
        </div>
      </section>

      <section className="vz-section vz-section--tight" aria-label={t('supplierSite.list.label')}>
        <div className="vz-container">
          {model.services.length === 0 ? (
            <div className="vz-state" data-testid="supplier-site-list-empty">
              <span className="vz-state__icon" aria-hidden="true">
                <ListFilter />
              </span>
              <h2>{t('supplierSite.services.emptyTitle')}</h2>
              <p>{t('supplierSite.services.emptyText')}</p>
            </div>
          ) : (
            <>
              <div className="vl-bar">
                {view.categories.length > 1 ? (
                  <div className="vl-chips" role="group" aria-label={t('supplierSite.list.categories')}>
                    <Link className="vl-chip" to={href({ cat: null })} aria-current={view.cat ? undefined : 'true'}>
                      {t('supplierSite.list.allCategories')}
                    </Link>
                    {view.categories.map((code) => (
                      <Link key={code} className="vl-chip" to={href({ cat: code })} aria-current={view.cat === code ? 'true' : undefined}>
                        {getServiceCategoryLabel(code, t)}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="vl-ctrl">
                  {view.kinds.length > 1 ? (
                    <label className="vl-sel">
                      <span>{t('supplierSite.list.priceLabel')}</span>
                      <select value={view.price ?? ''} onChange={(event) => setParams(withChoice({ price: event.target.value || null }))}>
                        <option value="">{t('supplierSite.list.priceAll')}</option>
                        {PRICE_KINDS.filter((kind) => view.kinds.includes(kind)).map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`supplierSite.list.price.${kind}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="vl-sel">
                    <span>{t('supplierSite.list.sortLabel')}</span>
                    <select
                      value={view.sort}
                      onChange={(event) => setParams(withChoice({ sort: event.target.value === 'recommended' ? null : event.target.value }))}
                    >
                      {SERVICE_SORTS.filter((sort) => sort !== 'slot' || model.bookingsOpen).map((sort) => (
                        <option key={sort} value={sort}>
                          {t(`supplierSite.list.sort.${sort}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <p className="vl-count" aria-live="polite" data-testid="supplier-site-list-count">
                {filtered
                  ? t('supplierSite.list.countOf', { count: view.list.length, total: model.services.length })
                  : t('supplierSite.list.count', { count: view.list.length })}
              </p>
              {view.list.length > 0 ? (
                <div className="vz-grid">
                  {view.list.map((service, index) => (
                    <Reveal key={service.slug} index={index}>
                      <ServiceCard service={service} showSlot={model.bookingsOpen} level={2} href={supplierSitePaths.service(model.slug, service.slug)} />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <div className="vz-state" data-testid="supplier-site-list-nomatch">
                  <span className="vz-state__icon" aria-hidden="true">
                    <ListFilter />
                  </span>
                  <h2>{t('supplierSite.list.noMatchTitle')}</h2>
                  <p>{t('supplierSite.list.noMatchText')}</p>
                  <div className="vz-state__actions">
                    <Link className="vz-btn vz-btn--primary vz-btn--lg" to={base}>
                      <RotateCcw aria-hidden="true" />
                      <span>{t('supplierSite.list.clear')}</span>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {model.bookingsOpen ? (
        <section className="vz-section vz-section--tint vl-quote" aria-labelledby="vl-quote">
          <div className="vz-container vl-quote__in">
            <div>
              <h2 id="vl-quote">{t('supplierSite.list.quoteTitle')}</h2>
              <p>{t('supplierSite.list.quoteText')}</p>
            </div>
            <Link className="vz-btn vz-btn--primary vz-btn--lg" to={buildInquiryPath(model.slug)}>
              <FileText aria-hidden="true" />
              <span>{t('supplierSite.cta.inquiry')}</span>
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
