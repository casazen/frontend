import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { formatStayDate } from '@/lib/stay-dates';
import { CategoryIcon } from './category-icon';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';
import { ServiceCard } from './service-card';

/** How many cards the home shows; the list of all the services is a page of its own. */
const HOME_SERVICES = 6;

/** The published services with the price they start from (the bookings flag is on). */
export function ServicesSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const shown = (model.services ?? []).slice(0, HOME_SERVICES);
  return (
    <section className="vz-section" id="servizi" aria-labelledby="vz-h-services" data-testid="supplier-site-services">
      <div className="vz-container">
        <SectionHead
          id="vz-h-services"
          eyebrow={t('supplierSite.services.eyebrow')}
          title={t('supplierSite.services.title')}
          text={model.bookingsOpen ? t('supplierSite.services.leadOpen') : t('supplierSite.services.leadClosed')}
          action={
            <Link className="vz-more" to={supplierSitePaths.services(model.slug)}>
              {t('supplierSite.services.all')}
              <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <div className="vz-grid">
          {shown.map((service, index) => (
            <Reveal key={service.slug} index={index}>
              <ServiceCard service={service} showSlot={model.bookingsOpen} href={supplierSitePaths.service(model.slug, service.slug)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** What the supplier does, by category: the block that stands in for the list of services while the list is not public. */
export function CategoriesSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  return (
    <section className="vz-section vz-section--tight" id="servizi" aria-labelledby="vz-h-categories" data-testid="supplier-site-categories">
      <div className="vz-container">
        <SectionHead id="vz-h-categories" eyebrow={t('supplierSite.categories.eyebrow')} title={t('supplierSite.categories.title')} />
        <Reveal>
          <ul className="vz-chips">
            {model.categories.map((code) => (
              <li key={code}>
                <CategoryIcon category={code} />
                {getServiceCategoryLabel(code, t)}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/** Who the supplier is, in its own words (the "chi siamo" it wrote, else the text of its profile) and its strengths. */
export function AboutSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  return (
    <section className="vz-section vz-section--tint" id="chi-siamo" aria-labelledby="vz-h-about" data-testid="supplier-site-about">
      <div className="vz-container vh-about__in">
        <SectionHead
          id="vz-h-about"
          eyebrow={t('supplierSite.about.eyebrow')}
          title={t('supplierSite.about.title')}
          action={
            model.blocks.aboutPage ? (
              <Link className="vz-more" to={supplierSitePaths.about(model.slug)}>
                {t('supplierSite.about.more')}
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : undefined
          }
        />
        <Reveal className="vh-about__text">
          {model.bio ? <p data-testid="supplier-site-bio">{model.bio}</p> : null}
          {model.values.length > 0 ? (
            <ul className="vh-values" aria-label={t('supplierSite.about.values')}>
              {model.values.map((value) => (
                <li key={value}>
                  <Check aria-hidden="true" />
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

/** The days of the next two weeks the supplier saved an availability for: all that is known of its calendar without the list of services. */
export function DaysSection({ model }: { model: SiteModel }) {
  const { t, i18n } = useTranslation();
  const free = model.availability.filter((day) => day.available).length;
  return (
    <section className="vz-section vz-section--tight" id="giorni" aria-labelledby="vz-h-days" data-testid="supplier-site-days">
      <div className="vz-container">
        <SectionHead
          id="vz-h-days"
          eyebrow={t('supplierSite.days.eyebrow')}
          title={t('supplierSite.days.title')}
          text={t('supplierShowcase.availableDays', { count: free })}
        />
        <Reveal>
          <ul className="vh-days">
            {model.availability.map((day) => (
              <li key={day.date} className={day.available ? 'is-free' : undefined}>
                <span>{formatStayDate(day.date, i18n.language, { weekday: 'short' })}</span>
                <strong>{formatStayDate(day.date, i18n.language, { day: 'numeric', month: 'short' })}</strong>
                <span className="sr-only">{day.available ? t('supplier.available') : t('supplier.notAvailable')}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
