import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CheckCircle2, Info, MapPin, XCircle } from 'lucide-react';
import { publicSupplierApi, type PublicSupplierService } from '@/api/public-supplier.api';
import { buildInquiryPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { comuneLabel } from '@/lib/comune-label';
import type { Comune } from '@/types/comune.types';
import { FinderComuneField } from './finder-comune-field';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';

type CheckTone = 'ok' | 'warn' | 'err';

/**
 * "Arriviamo da te?": the customer picks the comune and the supplier's own estimate says whether it covers it (the `coverage` of the
 * estimate of its first service). Only while the bookings are open; it answers with words, never with a map (no map: the comuni are
 * in the list beside it). A comune outside the zones is not a refusal: the supplier decides, and the request on measure is the way.
 */
function ZoneCheck({ model, service }: { model: SiteModel; service: PublicSupplierService }) {
  const { t } = useTranslation();
  const id = useId();
  const [comune, setComune] = useState<Comune | null>(null);
  const check = useMutation({
    mutationFn: (istatCode: string) => publicSupplierApi.quote(model.slug, { service: service.slug, comune: istatCode }),
  });

  const onChange = (picked: Comune | null) => {
    setComune(picked);
    if (picked) check.mutate(picked.istatCode);
    else check.reset();
  };

  let tone: CheckTone | null = null;
  let message = '';
  let inquiry = false;
  if (comune && check.isPending) {
    message = t('supplierSite.zones.checking');
  } else if (comune && check.isSuccess) {
    const place = comuneLabel(comune);
    if (check.data.coverage === 'Covered') {
      tone = 'ok';
      message = t('supplierSite.zones.covered', { place });
    } else if (check.data.coverage === 'Outside') {
      tone = 'warn';
      message = t('supplierSite.zones.outside', { place });
      inquiry = true;
    } else {
      message = t('supplierSite.zones.unknown', { place });
    }
  } else if (comune && check.isError) {
    tone = 'err';
    message = isAxiosError(check.error) && check.error.response?.status === 429 ? t('supplierSite.zones.tooMany') : t('supplierSite.zones.error');
  }

  return (
    <div className="vh-zonecheck" data-testid="supplier-site-zonecheck">
      <label htmlFor={`${id}-comune`}>{t('supplierSite.zones.checkLabel')}</label>
      <div className="vh-zonecheck__field">
        <FinderComuneField id={`${id}-comune`} value={comune} onChange={onChange} />
      </div>
      <p className={`vh-finder__msg${tone ? ` is-${tone}` : ''}`} aria-live="polite">
        {message ? (
          <>
            {tone === 'ok' ? <CheckCircle2 aria-hidden="true" /> : tone === 'err' ? <XCircle aria-hidden="true" /> : <Info aria-hidden="true" />}
            <span>{message}</span>
            {inquiry ? <Link to={buildInquiryPath(model.slug, { service: service.slug, comune: comune?.istatCode })}>{t('supplierSite.cta.inquiry')}</Link> : null}
          </>
        ) : null}
      </p>
    </div>
  );
}

/** Where the supplier works: the comuni it wrote in its profile, and, while the bookings are open, the check of a comune. */
export function ZonesSection({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const first = model.services?.[0];
  const names = model.comuni;
  const sentence =
    names.length === 1
      ? t('supplierSite.zones.leadOne', { place: names[0] })
      : t('supplierSite.zones.lead', { places: names.slice(0, -1).join(', '), last: names[names.length - 1] });

  return (
    <section className="vz-section" id="zone" aria-labelledby="vz-h-zones" data-testid="supplier-site-zones">
      <div className="vz-container vh-zones__text">
        <SectionHead id="vz-h-zones" eyebrow={t('supplierSite.zones.eyebrow')} title={t('supplierSite.zones.title')} text={sentence} />
        {model.bookingsOpen && first ? (
          <Reveal>
            <ZoneCheck model={model} service={first} />
          </Reveal>
        ) : null}
        <Reveal>
          <ul className="vz-chips" aria-label={t('supplierSite.zones.listLabel')}>
            {names.map((name) => (
              <li key={name}>
                <MapPin aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
