import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarCheck, FileText, Info, Lock, Undo2 } from 'lucide-react';
import type { PublicQuoteRequestBody, PublicSupplierServiceDetail, PublicSupplierSupplement } from '@/api/public-supplier.api';
import { Qty } from '@/components/ui/qty';
import { priceUnitLabel, supplementUnitLabel } from '@/features/supplier/services/lib/service-labels';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getProblemMessage } from '@/lib/api-errors';
import { buildBookingPath, buildInquiryPath } from '@/lib/supplier-site/booking-params';
import { formatDeadline, formatSlotLabel } from '@/lib/supplier-site/format';
import {
  defaultSelection,
  isPickedSupplement,
  maxUnits,
  SQUARE_METERS_MAX,
  SQUARE_METERS_STEP,
  surfaceChoices,
  surfaceSupplement,
  toBookingParams,
  toQuoteBody,
  type ServiceSelection,
} from '@/lib/supplier-site/service-options';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { useSupplierEstimate, useSupplierSlots } from '@/queries/use-public-supplier';
import type { Comune } from '@/types/comune.types';
import { FinderComuneField } from './finder-comune-field';

/** Pause after the last change before the estimate is asked: one request per decision, not per press (the server allows 30 a minute). */
const ESTIMATE_DEBOUNCE_MS = 400;
const FIRST_SLOTS = 3;
const MAX_HOURS = 12;
const MAX_SETS = 40;
const MIN_SQUARE_METERS = 10;

/** One option of the card: its label and, under it, what it is. */
function Option({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="vd-opt">
      <span className="vd-opt__l">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </div>
  );
}

interface ServiceBookCardProps {
  model: SiteModel;
  service: PublicSupplierServiceDetail;
}

/**
 * The card beside a service (SP-09-FE-b): the options that change the price (hours, sets or m² of the service, the surface, each
 * supplement), the **total estimated by the server** as they change, the first free times and the one action. The lines and the total
 * are those the server sends (`POST …/quote`), never added up here; it says they are an estimate and that the professional confirms
 * the price. A service on quote, or a comune outside the zones, has no total: it leads to the request on measure. With the bookings
 * closed the estimate is still there and the action is not.
 */
export function ServiceBookCard({ model, service }: ServiceBookCardProps) {
  const { t, i18n } = useTranslation();
  const ids = useId();
  const [selection, setSelection] = useState<ServiceSelection>(() => defaultSelection(service));
  const [comune, setComune] = useState<Comune | null>(null);
  const onQuote = service.requiresQuote || service.priceFromCents === null;

  // The body is debounced as a string: a new object on every render would restart the wait forever.
  const bodyKey = JSON.stringify(toQuoteBody(service, selection));
  const waited = useDebouncedValue(bodyKey, ESTIMATE_DEBOUNCE_MS);
  const body = useMemo<PublicQuoteRequestBody>(() => JSON.parse(waited) as PublicQuoteRequestBody, [waited]);
  const estimate = useSupplierEstimate(model.slug, body, !onQuote);
  const slots = useSupplierSlots(model.slug, service.slug, model.bookingsOpen && !onQuote);
  const firstSlots = (slots.data?.days ?? []).flatMap((day) => day.slots).slice(0, FIRST_SLOTS);

  const result = estimate.data;
  const quoteOnly = onQuote || result?.outcome === 'OnQuote' || result?.outcome === 'OutsideArea';
  const params = toBookingParams(service, selection);

  const setOption = (code: string, quantity: number) => setSelection((current) => ({ ...current, options: { ...current.options, [code]: quantity } }));
  const surface = surfaceSupplement(service);
  const supplements = service.supplements.filter(isPickedSupplement);

  const supplementControl = (supplement: PublicSupplierSupplement) => {
    const price = formatMoney(supplement.amountCents, i18n.language);
    if (supplement.per === 'flat') {
      return (
        <label key={supplement.code} className="vd-check">
          <input
            type="checkbox"
            checked={(selection.options[supplement.code] ?? 0) > 0}
            onChange={(event) => setOption(supplement.code, event.target.checked ? 1 : 0)}
          />
          <span>
            {supplement.label}
            <small>+ {price}</small>
          </span>
        </label>
      );
    }
    return (
      <Option key={supplement.code} label={supplement.label} hint={`+ ${price} · ${supplementUnitLabel(supplement.per, t)}`}>
        <Qty
          label={supplement.label}
          value={selection.options[supplement.code] ?? 0}
          min={0}
          max={maxUnits(supplement)}
          onChange={(value) => setOption(supplement.code, value)}
        />
      </Option>
    );
  };

  let totalText: ReactNode = null;
  if (!onQuote) {
    if (estimate.isError) totalText = <p className="vd-est__note is-err">{getProblemMessage(estimate.error, t) ?? t('supplierSite.service.estimateError')}</p>;
    else if (result?.outcome === 'Estimate' && result.totalCents !== null) {
      totalText = (
        <p className="vd-est__total">
          <span>{t('supplierSite.service.total')}</span>
          <strong data-testid="supplier-site-total">{formatMoney(result.totalCents, i18n.language)}</strong>
        </p>
      );
    } else if (result?.outcome === 'OutsideArea') totalText = <p className="vd-est__note is-warn">{t('supplierSite.service.outside')}</p>;
    else if (result?.outcome === 'OnQuote') totalText = <p className="vd-est__note">{t('supplierSite.service.onQuoteResult')}</p>;
    else totalText = <p className="vd-est__note">{t('supplierSite.service.estimating')}</p>;
  }

  return (
    <aside className="vd-card" aria-labelledby={`${ids}-title`} data-testid="supplier-site-bookcard">
      <h2 className="sr-only" id={`${ids}-title`}>
        {t('supplierSite.service.cardTitle', { name: service.name })}
      </h2>
      <div className="vd-card__price">
        {onQuote ? (
          <p className="vz-price vz-price--quote">
            <strong>{t('supplier.services.price.onQuote')}</strong>
          </p>
        ) : (
          <p className="vz-price vz-price--big">
            <span className="vz-price__lead">{t('supplierSite.services.from')}</span>
            <strong>{formatMoney(service.priceFromCents ?? 0, i18n.language)}</strong>
            <small>{priceUnitLabel(service.priceUnit, t)}</small>
            {service.pricesIncludeVat ? <small className="vz-vat">{t('supplierSite.services.vatIncluded')}</small> : null}
          </p>
        )}
      </div>

      {onQuote ? (
        <p className="vd-card__quote">{t('supplierSite.service.quoteIntro')}</p>
      ) : (
        <>
          <div className="vd-opts">
            {service.priceUnit === 'PerHour' ? (
              <Option label={t('supplierSite.service.hours')}>
                <Qty
                  label={t('supplierSite.service.hours')}
                  value={selection.quantity ?? 1}
                  min={1}
                  max={MAX_HOURS}
                  onChange={(quantity) => setSelection((current) => ({ ...current, quantity }))}
                />
              </Option>
            ) : null}
            {service.priceUnit === 'PerSet' ? (
              <Option label={t('supplierSite.service.sets')}>
                <Qty
                  label={t('supplierSite.service.sets')}
                  value={selection.quantity ?? 1}
                  min={1}
                  max={MAX_SETS}
                  onChange={(quantity) => setSelection((current) => ({ ...current, quantity }))}
                />
              </Option>
            ) : null}
            {service.priceUnit === 'PerSquareMeter' ? (
              <Option label={t('supplierSite.service.squareMeters')}>
                <Qty
                  label={t('supplierSite.service.squareMeters')}
                  value={selection.quantity ?? MIN_SQUARE_METERS}
                  min={MIN_SQUARE_METERS}
                  max={SQUARE_METERS_MAX}
                  step={SQUARE_METERS_STEP}
                  onChange={(quantity) => setSelection((current) => ({ ...current, quantity }))}
                />
              </Option>
            ) : null}
            {surface ? (
              <Option label={t('supplierSite.service.surface')} htmlFor={`${ids}-surface`}>
                <select
                  id={`${ids}-surface`}
                  value={selection.surface ?? ''}
                  onChange={(event) => setSelection((current) => ({ ...current, surface: Number(event.target.value) }))}
                >
                  {surfaceChoices(surface).map((sqm, index, all) => (
                    <option key={sqm} value={sqm}>
                      {index === 0
                        ? t('supplierSite.service.surfaceUpTo', { sqm })
                        : t('supplierSite.service.surfaceBetween', { from: all[index - 1] + 1, to: sqm })}
                    </option>
                  ))}
                </select>
              </Option>
            ) : null}
            {supplements.map(supplementControl)}
            <Option label={t('supplierSite.service.where')} htmlFor={`${ids}-comune`}>
              <div className="vd-comune">
                <FinderComuneField
                  id={`${ids}-comune`}
                  value={comune}
                  onChange={(picked) => {
                    setComune(picked);
                    setSelection((current) => ({ ...current, comune: picked?.istatCode ?? null }));
                  }}
                />
              </div>
            </Option>
          </div>
          <div className="vd-est" aria-live="polite" aria-busy={estimate.isFetching} data-testid="supplier-site-estimate">
            {result && result.lines.length > 0 ? (
              <ul className="vd-est__lines">
                {result.lines.map((line, index) => (
                  <li key={`${line.kind}-${line.code ?? index}`}>
                    <span>
                      {line.label}
                      {line.quantity > 1 ? ` × ${line.quantity}` : ''}
                    </span>
                    <span>{formatMoney(line.amountCents, i18n.language)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {totalText}
            {result?.outcome === 'Estimate' ? <p className="vd-est__note">{t('supplierSite.service.estimateNote')}</p> : null}
          </div>
        </>
      )}

      {model.bookingsOpen && !onQuote ? (
        <div className="vd-slots">
          <p className="vd-slots__t">{firstSlots.length > 0 ? t('supplierSite.service.firstSlots') : t('supplierSite.service.noSlots')}</p>
          {firstSlots.length > 0 ? (
            <ul>
              {firstSlots.map((slot) => (
                <li key={slot.startUtc}>
                  <Link className="vd-slot" to={buildBookingPath(model.slug, { ...params, start: slot.startUtc })}>
                    <strong>{formatSlotLabel(slot.startUtc, t, i18n.language)}</strong>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {model.bookingsOpen ? (
        quoteOnly ? (
          <Link className="vz-btn vz-btn--primary vz-btn--lg vd-card__cta" to={buildInquiryPath(model.slug, { service: service.slug, comune: selection.comune ?? undefined })}>
            <FileText aria-hidden="true" />
            <span>{t('supplierSite.cta.inquiry')}</span>
          </Link>
        ) : (
          <Link className="vz-btn vz-btn--primary vz-btn--lg vd-card__cta" to={buildBookingPath(model.slug, params)}>
            <CalendarCheck aria-hidden="true" />
            <span>{t('supplierSite.service.bookThis')}</span>
          </Link>
        )
      ) : (
        <p className="vd-card__closed" data-testid="supplier-site-card-closed">
          <Info aria-hidden="true" />
          <span>{t('supplierSite.hero.closed')}</span>
        </p>
      )}

      {model.bookingsOpen ? (
        <ul className="vd-trust">
          {model.respondWithinMinutes ? (
            <li>
              <Info aria-hidden="true" />
              <span>{t('supplierSite.service.confirmWithin', { deadline: formatDeadline(model.respondWithinMinutes, t) })}</span>
            </li>
          ) : null}
          <li>
            <Lock aria-hidden="true" />
            <span>{t('supplierSite.service.paySafe')}</span>
          </li>
          <li>
            <Undo2 aria-hidden="true" />
            <span>{t('supplierSite.service.cancelFree')}</span>
          </li>
        </ul>
      ) : null}
    </aside>
  );
}
