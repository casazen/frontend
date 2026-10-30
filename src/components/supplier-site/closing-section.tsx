import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, FileText } from 'lucide-react';
import { buildBookingPath, buildInquiryPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { Reveal } from './reveal';

/** The band that closes the home while the bookings are open: the two ways on, booking and the request on measure. Nothing to call. */
export function ClosingSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  return (
    <section className="vh-cta" aria-labelledby="vz-h-cta" data-testid="supplier-site-closing">
      <div className="vz-container vh-cta__in">
        <Reveal className="vh-cta__text">
          <p className="vz-eyebrow vh-cta__eyebrow">{t('supplierSite.closing.eyebrow')}</p>
          <h2 id="vz-h-cta">{t('supplierSite.closing.title')}</h2>
          <p>{t('supplierSite.closing.text')}</p>
        </Reveal>
        <Reveal className="vh-cta__book" index={1}>
          <Link className="vz-btn vz-btn--primary vz-btn--lg" to={buildBookingPath(model.slug)}>
            <CalendarCheck aria-hidden="true" />
            <span>{t('supplierSite.closing.book')}</span>
          </Link>
          <Link className="vz-btn vz-btn--secondary vz-btn--lg" to={buildInquiryPath(model.slug)}>
            <FileText aria-hidden="true" />
            <span>{t('supplierSite.cta.inquiry')}</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
