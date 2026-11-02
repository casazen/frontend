import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Check, FileText, MapPin, ShieldCheck, Users } from 'lucide-react';
import { GuaranteeSection } from '@/components/supplier-site/guarantee-section';
import { Reveal } from '@/components/supplier-site/reveal';
import { SectionHead } from '@/components/supplier-site/section-head';
import { useSupplierSite } from '@/components/supplier-site/site-context';
import { SiteCrumbs } from '@/components/supplier-site/site-crumbs';
import { buildBookingPath, buildInquiryPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';

/** The first letters of a person's name, for the round mark that stands for a photo the supplier has not given. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toUpperCase();
}

function PeopleSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  return (
    <section className="vz-section" aria-labelledby="vw-team" data-testid="supplier-site-team">
      <div className="vz-container">
        <SectionHead id="vw-team" eyebrow={t('supplierSite.about.peopleEyebrow')} title={t('supplierSite.about.peopleTitle')} />
        <ul className="vw-people">
          {model.team.map((person, index) => (
            <Reveal key={`${person.name}-${index}`} as="li" className="vw-person" index={index}>
              <span className="vw-person__a" aria-hidden="true">
                {initials(person.name)}
              </span>
              <div>
                <strong>{person.name}</strong>
                {person.role ? <span>{person.role}</span> : null}
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * "Chi siamo", `/fornitori/:slug/chi-siamo` (SP-09-FE-b): the story the supplier wrote, the people (name and role, with their initials),
 * the strengths, the guarantee and the certifications **it wrote**, where it works, and the two ways on. Only what exists: no contacts,
 * no form, no VAT number, no reviews, no "insured" (D11, D13, VT-D14, interview Q4/Q7). A supplier with nothing to say gets a calm page.
 */
export function SupplierAboutPage() {
  const { t } = useTranslation();
  const { model } = useSupplierSite();

  return (
    <div data-testid="supplier-site-about-page">
      <section className="vw-head">
        <div className="vz-container">
          <SiteCrumbs slug={model.slug} items={[{ label: t('supplierSite.about.title') }]} />
          <p className="vz-eyebrow">{t('supplierSite.about.title')}</p>
          <h1 id="vz-title" tabIndex={-1}>
            {t('supplierSite.about.pageTitle', { name: model.name })}
          </h1>
          {model.bio ? (
            <p className="vw-head__lead" data-testid="supplier-site-bio">
              {model.bio}
            </p>
          ) : null}
          <ul className="vw-head__facts">
            {model.comuni.length > 0 ? (
              <li>
                <MapPin aria-hidden="true" />
                <span>{t('supplierSite.about.where', { places: model.comuni.slice(0, 3).join(', ') })}</span>
              </li>
            ) : null}
            {model.team.length > 0 ? (
              <li>
                <Users aria-hidden="true" />
                <span>{t('supplierSite.about.people', { count: model.team.length })}</span>
              </li>
            ) : null}
            {model.trust.some((item) => item.kind === 'verified') ? (
              <li>
                <BadgeCheck aria-hidden="true" />
                <span>{t('supplierSite.trust.verifiedLine')}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      {model.team.length > 0 ? <PeopleSection model={model} /> : null}

      {model.values.length > 0 ? (
        <section className="vz-section vz-section--tint" aria-labelledby="vw-values" data-testid="supplier-site-values">
          <div className="vz-container">
            <SectionHead id="vw-values" eyebrow={t('supplierSite.about.valuesEyebrow')} title={t('supplierSite.about.values')} />
            <Reveal>
              <ul className="vw-values">
                {model.values.map((value) => (
                  <li key={value}>
                    <Check aria-hidden="true" />
                    <span>{value}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      ) : null}

      {model.guarantee || model.certs.length > 0 ? <GuaranteeSection model={model} /> : null}

      {!model.blocks.aboutPage ? (
        <div className="vz-container" data-testid="supplier-site-about-empty">
          <section className="vz-state">
            <span className="vz-state__icon" aria-hidden="true">
              <ShieldCheck />
            </span>
            <h2>{t('supplierSite.about.emptyTitle')}</h2>
            <p>{t('supplierSite.about.emptyText')}</p>
          </section>
        </div>
      ) : null}

      {model.bookingsOpen ? (
        <section className="vh-cta" aria-labelledby="vw-cta" data-testid="supplier-site-about-cta">
          <div className="vz-container vh-cta__in">
            <Reveal className="vh-cta__text">
              <p className="vz-eyebrow vh-cta__eyebrow">{t('supplierSite.closing.eyebrow')}</p>
              <h2 id="vw-cta">{t('supplierSite.about.ctaTitle')}</h2>
            </Reveal>
            <Reveal className="vh-cta__book" index={1}>
              <Link className="vz-btn vz-btn--primary vz-btn--lg" to={buildBookingPath(model.slug)}>
                {t('supplierSite.closing.book')}
              </Link>
              <Link className="vz-btn vz-btn--secondary vz-btn--lg" to={buildInquiryPath(model.slug)}>
                <FileText aria-hidden="true" />
                <span>{t('supplierSite.cta.inquiry')}</span>
              </Link>
              <Link className="vz-more" to={supplierSitePaths.services(model.slug)}>
                {t('supplierSite.list.all')}
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}
    </div>
  );
}
