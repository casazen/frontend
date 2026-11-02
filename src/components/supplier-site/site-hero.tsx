import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BadgeCheck, CalendarCheck, ClipboardCheck, Info } from 'lucide-react';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatSlotLabel } from '@/lib/supplier-site/format';
import { buildBookingPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel, SiteTrustItem } from '@/lib/supplier-site/site-model';
import { InquiryLink, SiteFinder } from './site-finder';
import { SiteMedia } from './site-media';

/** The one signal of trust above the fold: "Verificato", else the jobs done. Nothing else is said before the page is scrolled. */
function HeroSignal({ item }: { item: SiteTrustItem | null }) {
  const { t } = useTranslation();
  if (!item) return null;
  return (
    <p className="vz-signal" data-testid="supplier-site-hero-signal">
      {item.kind === 'verified' ? <BadgeCheck aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />}
      <span>
        {item.kind === 'verified' ? t('supplierSite.trust.verifiedLine') : t('supplierSite.trust.jobsLine', { count: item.count ?? 0 })}
      </span>
    </p>
  );
}

/** What the cover offers to do: the finder while the bookings are open, else, at most, a way down to the services. */
function HeroAction({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const services = model.services && model.services.length > 0 ? model.services : null;
  if (model.bookingsOpen && services) {
    return (
      <>
        <SiteFinder model={model} services={services} />
        <InquiryLink model={model} />
      </>
    );
  }
  return (
    <div className="vh-hero__calm">
      {model.bookingsClosed ? (
        <p className="vh-hero__note" data-testid="supplier-site-bookings-closed">
          <Info aria-hidden="true" />
          <span>{t('supplierSite.hero.closed')}</span>
        </p>
      ) : null}
      {services ? (
        <a className="vz-btn vz-btn--primary vz-btn--lg" href="#servizi">
          {t('supplierSite.hero.seeServices')}
        </a>
      ) : null}
    </div>
  );
}

/**
 * The cover of the home (SP-09-FE): the supplier's sentence (or its name), a line under it and **one** action. With a full-width
 * scene (styles «acqua» and «scintilla») the text sits on the picture under a dark veil; in the light cover (styles «fresco» and
 * «naturale») the picture is on the right and carries the first free slot. Without a photo the picture is a neutral fill (VT-D19).
 */
export function SiteHero({ model }: { model: SiteModel }) {
  const { t, i18n } = useTranslation();
  const full = model.hero === 'full';
  const eyebrow = [
    ...model.categories.slice(0, 2).map((code) => getServiceCategoryLabel(code, t)),
    ...(model.comuni[0] ? [model.comuni[0]] : []),
  ].join(' · ');

  const copy: ReactNode = (
    <>
      {eyebrow ? <p className="vz-eyebrow vh-hero__eyebrow">{eyebrow}</p> : null}
      <h1 id="vz-title" tabIndex={-1}>
        {model.tagline ? (
          <>
            <span className="sr-only">{model.name} · </span>
            {model.tagline}
          </>
        ) : (
          model.name
        )}
      </h1>
      {model.intro ? <p className="vh-hero__lead">{model.intro}</p> : null}
      <HeroSignal item={model.heroTrust} />
    </>
  );

  if (full) {
    return (
      <section className="vh-hero vh-hero--full" aria-labelledby="vz-title" data-testid="supplier-site-hero">
        <div className="vh-hero__media" aria-hidden="true">
          <SiteMedia url={model.coverUrl} alt="" category={model.categories[0]} priority />
        </div>
        <div className="vh-hero__scrim" aria-hidden="true" />
        <div className="vz-container vh-hero__in">
          <div className="vh-hero__copy">{copy}</div>
          <div className="vh-hero__find">
            <HeroAction model={model} />
          </div>
        </div>
      </section>
    );
  }

  const slot = model.firstSlot;
  return (
    <section className="vh-hero vh-hero--split" aria-labelledby="vz-title" data-testid="supplier-site-hero">
      <div className="vz-container vh-hero__in">
        <div className="vh-hero__copy">
          {copy}
          <div className="vh-hero__find">
            <HeroAction model={model} />
          </div>
        </div>
        <div className="vh-hero__art">
          <SiteMedia url={model.coverUrl} alt={model.coverAlt} category={model.categories[0]} priority />
          {slot ? (
            <Link
              className="vh-next"
              to={buildBookingPath(model.slug, { service: slot.service.slug, start: slot.startUtc })}
              data-testid="supplier-site-first-slot"
            >
              <span className="vh-next__i">
                <CalendarCheck aria-hidden="true" />
              </span>
              <span className="vh-next__t">
                <small>{t('supplierSite.hero.firstSlot')}</small>
                <strong>{formatSlotLabel(slot.startUtc, t, i18n.language)}</strong>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
