import { useTranslation } from 'react-i18next';
import { Info, Lock, Undo2 } from 'lucide-react';
import type { PublicQuoteResponse } from '@/api/public-supplier.api';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { formatDeadline, formatSlotLabel } from '@/lib/supplier-site/format';

export interface BookingSummaryData {
  supplierName: string;
  serviceName: string | null;
  comuneName: string | null;
  startUtc: string | null;
  urgent: boolean;
  /** The estimate the server made for what is chosen; the lines and the total are its, never added up here. */
  estimate: { data: PublicQuoteResponse | undefined; isFetching: boolean; isError: boolean };
  acceptsOnlinePayments: boolean;
  respondWithinMinutes: number | null;
}

/**
 * "Il tuo riepilogo": what was chosen and the total the server estimated, always at hand. Every sentence is true or absent: the total is
 * an estimate (the professional confirms the price before starting), the money is said to be held only when the booking is paid
 * inside CasaZen, and nothing promises a time of answer other than the supplier's own setting.
 */
export function BookingSummary({ data }: { data: BookingSummaryData }) {
  const { t, i18n } = useTranslation();
  const { estimate } = data;
  const result = estimate.data;
  const total = result?.outcome === 'Estimate' && result.totalCents !== null ? result.totalCents : null;
  const rows: Array<[string, string]> = [];
  if (data.comuneName) rows.push([t('supplierSite.booking.summary.where'), data.comuneName]);
  if (data.startUtc) rows.push([t('supplierSite.booking.summary.when'), formatSlotLabel(data.startUtc, t, i18n.language)]);
  if (data.urgent) rows.push([t('supplierSite.booking.summary.urgent'), t('supplierSite.booking.summary.urgentValue')]);

  return (
    <div className="vb-sum" data-testid="supplier-booking-summary">
      <h2 className="vb-sum__h">{t('supplierSite.booking.summary.title')}</h2>
      {data.serviceName ? (
        <p className="vb-sum__svc">
          <strong>{data.serviceName}</strong>
          <small>{data.supplierName}</small>
        </p>
      ) : (
        <p className="vb-sum__empty">{t('supplierSite.booking.summary.empty')}</p>
      )}
      {rows.length > 0 ? (
        <dl className="vb-sum__rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {result && result.lines.length > 0 ? (
        <ul className="vb-sum__lines">
          {result.lines.map((line, index) => (
            <li key={`${line.kind}-${line.code ?? index}`}>
              <span>
                {line.kind === 'Urgent' ? t('supplierSite.service.urgentLine') : line.label}
                {line.quantity > 1 ? ` × ${line.quantity}` : ''}
              </span>
              <span>{formatMoney(line.amountCents, i18n.language)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {data.serviceName ? (
        <div className="vb-sum__total" aria-live="polite" aria-busy={estimate.isFetching}>
          <span>{t('supplierSite.service.total')}</span>
          {total !== null ? <strong>{formatMoney(total, i18n.language)}</strong> : estimate.isError ? <strong>—</strong> : <small>{t('supplierSite.service.estimating')}</small>}
        </div>
      ) : null}
      {total !== null ? <p className="vb-sum__note">{t('supplierSite.service.estimateNote')}</p> : null}
      {estimate.isError ? <p className="vb-sum__note">{t('supplierSite.service.estimateError')}</p> : null}
      {data.acceptsOnlinePayments && total !== null ? (
        <p className="vb-sum__pay">
          <Lock aria-hidden="true" />
          <span>{t('supplierSite.booking.summary.hold')}</span>
        </p>
      ) : null}
      <ul className="vb-sum__trust">
        {data.respondWithinMinutes ? (
          <li>
            <Info aria-hidden="true" />
            <span>{t('supplierSite.service.confirmWithin', { deadline: formatDeadline(data.respondWithinMinutes, t) })}</span>
          </li>
        ) : null}
        <li>
          <Undo2 aria-hidden="true" />
          <span>{t('supplierSite.service.cancelFree')}</span>
        </li>
      </ul>
    </div>
  );
}
