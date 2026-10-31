import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, FileText, Lock } from 'lucide-react';
import { buildInquiryPath } from '@/lib/supplier-site/booking-params';
import { useComuneDatasetStatus } from '@/queries/use-comuni';
import type { Comune } from '@/types/comune.types';
import { FinderComuneField } from '../finder-comune-field';

/** What the estimate says of the comune: the supplier's zones are checked by the server, never here. */
export type ZoneState = 'none' | 'checking' | 'covered' | 'outside' | 'unknown';

interface StepWhereProps {
  supplierSlug: string;
  serviceSlug: string;
  comune: { name: string; provinceCode: string; istatCode: string } | null;
  onComune: (comune: Comune | null) => void;
  zone: ZoneState;
  /** The person went on without a comune. */
  problem: 'required' | null;
}

/** Step 2, "Dove": the comune of the work, and at once whether the supplier works there. */
export function StepWhere({ supplierSlug, serviceSlug, comune, onComune, zone, problem }: StepWhereProps) {
  const { t } = useTranslation();
  const id = useId();
  // The official list of comuni is what the field searches: if it is not there, say so instead of an empty list that never answers.
  const list = useComuneDatasetStatus();
  const listMissing = list.isSuccess && list.data.datasetAvailable === false;
  return (
    <div className="vb-step-where">
      <div className="vb-field">
        <label className="vb-label" htmlFor={id}>
          {t('supplierSite.booking.where.label')}
        </label>
        <p className="vb-hint">{t('supplierSite.booking.where.hint')}</p>
        <div className="vb-comune">
          <FinderComuneField id={id} value={comune} onChange={onComune} />
        </div>
        {problem ? (
          <p className="vb-error" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{t('supplierSite.booking.problems.comune.required')}</span>
          </p>
        ) : null}
      </div>

      {listMissing ? (
        <div className="vb-callout" data-testid="supplier-booking-no-comuni">
          <p className="is-warn">
            <CircleAlert aria-hidden="true" />
            <span>{t('supplierSite.booking.where.noList')}</span>
          </p>
          <Link className="vz-btn vz-btn--secondary" to={buildInquiryPath(supplierSlug, { service: serviceSlug })}>
            <FileText aria-hidden="true" />
            <span>{t('supplierSite.cta.inquiry')}</span>
          </Link>
        </div>
      ) : null}

      <div className="vb-zone" aria-live="polite" data-zone={zone}>
        {zone === 'checking' ? <p>{t('supplierSite.booking.where.checking')}</p> : null}
        {zone === 'covered' && comune ? (
          <p className="is-ok">
            <CircleCheck aria-hidden="true" />
            <span>{t('supplierSite.booking.where.covered', { comune: comune.name })}</span>
          </p>
        ) : null}
        {zone === 'outside' && comune ? (
          <div className="vb-callout">
            <p className="is-warn">
              <CircleAlert aria-hidden="true" />
              <span>{t('supplierSite.booking.where.outside', { comune: comune.name })}</span>
            </p>
            <Link className="vz-btn vz-btn--secondary" to={buildInquiryPath(supplierSlug, { service: serviceSlug, comune: comune.istatCode })}>
              <FileText aria-hidden="true" />
              <span>{t('supplierSite.cta.inquiry')}</span>
            </Link>
          </div>
        ) : null}
      </div>

      <p className="vb-hint vb-hint--icon">
        <Lock aria-hidden="true" />
        <span>{t('supplierSite.booking.where.privacy')}</span>
      </p>
    </div>
  );
}
