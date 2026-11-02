import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicSupplierServiceDetail, PublicSupplierSupplement } from '@/api/public-supplier.api';
import { Qty } from '@/components/ui/qty';
import { supplementUnitLabel } from '@/features/supplier/services/lib/service-labels';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import {
  isPickedSupplement,
  maxUnits,
  SQUARE_METERS_MAX,
  SQUARE_METERS_STEP,
  surfaceChoices,
  surfaceSupplement,
  type ServiceSelection,
} from '@/lib/supplier-site/service-options';

const MAX_HOURS = 12;
const MAX_SETS = 40;
const MIN_SQUARE_METERS = 10;

/** One option: its label and, under it, what it is; the control on the right. Same look as the card of the service (`vd-opt`). */
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

interface ServiceOptionsFieldsProps {
  service: PublicSupplierServiceDetail;
  selection: ServiceSelection;
  onQuantity: (quantity: number) => void;
  onSurface: (surface: number) => void;
  onOption: (code: string, quantity: number) => void;
}

/**
 * What changes the price of the service the customer chose: the hours, the sets or the square meters of its own price, the size of the
 * home, each supplement. It only says what was chosen; the total is the server's (`POST …/quote`), never added up here.
 */
export function ServiceOptionsFields({ service, selection, onQuantity, onSurface, onOption }: ServiceOptionsFieldsProps) {
  const { t, i18n } = useTranslation();
  const surfaceId = useId();
  const surface = surfaceSupplement(service);
  const supplements = service.supplements.filter(isPickedSupplement);

  const supplementControl = (supplement: PublicSupplierSupplement) => {
    const price = formatMoney(supplement.amountCents, i18n.language);
    if (supplement.per === 'flat') {
      return (
        <label key={supplement.code} className="vd-check">
          <input type="checkbox" checked={(selection.options[supplement.code] ?? 0) > 0} onChange={(event) => onOption(supplement.code, event.target.checked ? 1 : 0)} />
          <span>
            {supplement.label}
            <small>+ {price}</small>
          </span>
        </label>
      );
    }
    return (
      <Option key={supplement.code} label={supplement.label} hint={`+ ${price} · ${supplementUnitLabel(supplement.per, t)}`}>
        <Qty label={supplement.label} value={selection.options[supplement.code] ?? 0} min={0} max={maxUnits(supplement)} onChange={(value) => onOption(supplement.code, value)} />
      </Option>
    );
  };

  const hasQuantity = service.priceUnit !== 'PerJob';
  if (!hasQuantity && !surface && supplements.length === 0) return null;

  return (
    <div className="vd-opts vb-opts" data-testid="supplier-booking-options">
      <h3 className="vb-opts__t">{t('supplierSite.booking.service.optionsTitle')}</h3>
      {service.priceUnit === 'PerHour' ? (
        <Option label={t('supplierSite.service.hours')}>
          <Qty label={t('supplierSite.service.hours')} value={selection.quantity ?? 1} min={1} max={MAX_HOURS} onChange={onQuantity} />
        </Option>
      ) : null}
      {service.priceUnit === 'PerSet' ? (
        <Option label={t('supplierSite.service.sets')}>
          <Qty label={t('supplierSite.service.sets')} value={selection.quantity ?? 1} min={1} max={MAX_SETS} onChange={onQuantity} />
        </Option>
      ) : null}
      {service.priceUnit === 'PerSquareMeter' ? (
        <Option label={t('supplierSite.service.squareMeters')}>
          <Qty label={t('supplierSite.service.squareMeters')} value={selection.quantity ?? MIN_SQUARE_METERS} min={MIN_SQUARE_METERS} max={SQUARE_METERS_MAX} step={SQUARE_METERS_STEP} onChange={onQuantity} />
        </Option>
      ) : null}
      {surface ? (
        <Option label={t('supplierSite.service.surface')} htmlFor={surfaceId}>
          <select id={surfaceId} value={selection.surface ?? ''} onChange={(event) => onSurface(Number(event.target.value))}>
            {surfaceChoices(surface).map((sqm, index, all) => (
              <option key={sqm} value={sqm}>
                {index === 0 ? t('supplierSite.service.surfaceUpTo', { sqm }) : t('supplierSite.service.surfaceBetween', { from: all[index - 1] + 1, to: sqm })}
              </option>
            ))}
          </select>
        </Option>
      ) : null}
      {supplements.map(supplementControl)}
    </div>
  );
}
