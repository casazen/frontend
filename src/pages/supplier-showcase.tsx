import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { useSupplierSite } from '@/components/supplier-site/site-context';
import { SiteHero } from '@/components/supplier-site/site-hero';
import { TrustBar } from '@/components/supplier-site/trust-bar';
import { AboutSection, CategoriesSection, DaysSection, ServicesSection } from '@/components/supplier-site/home-sections';
import { ZonesSection } from '@/components/supplier-site/zones-section';
import { supplierShowcasePath } from '@/features/supplier/lib/showcase-paths';

/**
 * The home of a supplier's public site, `/fornitori/:slug` (SU-13, A4-16, SP-09-FE): the cover with its one action, then the blocks
 * that have something true to say, each with one job. The data, the states (loading, not found, error, paused, offline) and the frame
 * (header, footer, cookies, SEO) are those of `SupplierSiteShell`, whose child this page is. Indexable, as it always was: `noindex`
 * only applies to a showcase that does not exist or fails to load.
 */
export function SupplierShowcasePage() {
  const { t } = useTranslation();
  const { model } = useSupplierSite();
  const { blocks } = model;
  // The list of services is public (the bookings flag is on) but empty: said, not left blank.
  const noServicesYet = model.services !== null && model.services.length === 0;

  return (
    <div data-testid="supplier-showcase">
      <SiteHero model={model} />
      <TrustBar model={model} />
      {blocks.services ? <ServicesSection model={model} /> : null}
      {blocks.categories ? <CategoriesSection model={model} /> : null}
      {noServicesYet ? (
        <div className="vz-container" data-testid="supplier-site-no-services">
          <section className="vz-state">
            <span className="vz-state__icon" aria-hidden="true">
              <CalendarClock />
            </span>
            <h2>{t('supplierSite.services.emptyTitle')}</h2>
            <p>{t('supplierSite.services.emptyText')}</p>
          </section>
        </div>
      ) : null}
      {blocks.about ? <AboutSection model={model} /> : null}
      {blocks.zones ? <ZonesSection model={model} /> : null}
      {blocks.days ? <DaysSection model={model} /> : null}
    </div>
  );
}

/** The old address `/s/:slug` (it never worked: see A4-16) leads to the showcase. */
export function LegacySupplierShowcaseRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={supplierShowcasePath(slug ?? '')} replace />;
}
