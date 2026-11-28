import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, FileText } from 'lucide-react';
import type { PublicSupplierService } from '@/api/public-supplier.api';
import { buildBookingPath, buildInquiryPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { Comune } from '@/types/comune.types';
import { FinderComuneField } from './finder-comune-field';

const FINDER_HORIZON_DAYS = 60;

export function SiteFinder({ model, services }: { model: SiteModel; services: PublicSupplierService[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ids = useId();
  const [serviceSlug, setServiceSlug] = useState(services[0]?.slug ?? '');
  const [comune, setComune] = useState<Comune | null>(null);
  const [day, setDay] = useState('');
  const today = todayInRome();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const service = services.find((candidate) => candidate.slug === serviceSlug);
    const params = { service: serviceSlug || undefined, comune: comune?.istatCode, day: day || undefined };
    navigate(service?.requiresQuote ? buildInquiryPath(model.slug, params) : buildBookingPath(model.slug, params));
  };

  return (
    <form className="vh-finder" onSubmit={submit} noValidate aria-label={t('supplierSite.finder.label')} data-testid="supplier-site-finder">
      <div className="vh-finder__f">
        <label htmlFor={`${ids}-service`}>{t('supplierSite.finder.service')}</label>
        <select id={`${ids}-service`} name="service" value={serviceSlug} onChange={(event) => setServiceSlug(event.target.value)}>
          {services.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.requiresQuote ? t('supplierSite.finder.onQuote', { name: service.name }) : service.name}
            </option>
          ))}
        </select>
      </div>
      <div className="vh-finder__f">
        <label htmlFor={`${ids}-comune`}>{t('supplierSite.finder.comune')}</label>
        <FinderComuneField id={`${ids}-comune`} value={comune} onChange={setComune} />
      </div>
      <div className="vh-finder__f">
        <label htmlFor={`${ids}-day`}>{t('supplierSite.finder.day')}</label>
        <input
          id={`${ids}-day`}
          name="day"
          type="date"
          min={today}
          max={addDays(today, FINDER_HORIZON_DAYS)}
          value={day}
          onChange={(event) => setDay(event.target.value)}
        />
      </div>
      <button type="submit" className="vz-btn vz-btn--primary vz-btn--lg vh-finder__go">
        <CalendarCheck aria-hidden="true" />
        <span>{t('supplierSite.cta.book')}</span>
      </button>
    </form>
  );
}

export function InquiryLink({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  return (
    <p className="vh-quote">
      <Link to={buildInquiryPath(model.slug)}>
        <FileText aria-hidden="true" />
        <span>
          {t('supplierSite.finder.inquiryLead')} <strong>{t('supplierSite.cta.inquiry')}</strong>
        </span>
      </Link>
    </p>
  );
}
