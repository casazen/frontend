import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { getProblemMessage } from '@/lib/api-errors';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { useProperties, useProperty } from '@/queries/use-properties';
import type { LeaseNeed } from '@/types';
import { PropertyRequirements } from './property-requirements';

interface PropertyStepProps {
  /** The property chosen, or an empty text. */
  value: string;
  onChange: (propertyId: string) => void;
  /** The format error of the field (a key of the translations). */
  error?: string;
  /** What the server says is missing in the step, once the draft exists; `undefined` before. */
  needs?: LeaseNeed[];
  /** The contract is already signed elsewhere: the APE and the cadastral data are a notice, not a stop. */
  imported: boolean;
}

/**
 * Step ① «Immobile» (LR-06a): the property of the contract, among the ones let for long stays, and what the contract needs from it.
 * A property named in the address that is let for short stays is not in the list: it is read on its own, offered, and told as such
 * (a notice, not a stop: the passage to long stays is the host's choice, LR-D15).
 */
export function PropertyStep({ value, onChange, error, needs, imported }: PropertyStepProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error: loadError, refetch, isFetching } = useProperties({ mode: 'long' });
  const listed = data ?? [];
  const inList = listed.some((property) => property.id === value);
  const { data: outside } = useProperty(data !== undefined && value && !inList ? value : '');
  const options = outside && !inList ? [...listed, outside] : listed;
  const selected = options.find((property) => property.id === value);
  const noProperties = !isLoading && !isError && data !== undefined && listed.length === 0 && !value;

  return (
    <div className="space-y-6">
      {isError ? (
        <div
          role="alert"
          data-testid="lease-properties-error"
          className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <span className="flex-1">{getProblemMessage(loadError, t) ?? t('leases.form.propertiesLoadError')}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {t('leases.form.retry')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label={t('leases.form.propertyLabel')} error={error}>
            <Select
              id="lw-property"
              value={value}
              aria-busy={isLoading}
              onChange={(event) => onChange(event.target.value)}
              data-testid="lease-property-select"
            >
              <option value="">{isLoading ? t('leases.form.propertiesLoading') : t('leases.form.selectProperty')}</option>
              {options.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} — {property.city}
                </option>
              ))}
            </Select>
          </Field>
          {noProperties ? (
            <p role="status" data-testid="lease-no-properties" className="text-sm text-muted-foreground">
              {t('leases.form.noProperties')}
            </p>
          ) : null}
          <Button asChild variant={noProperties ? 'default' : 'ghost'} size="sm">
            <Link to={LONG_RENT_PROPERTY_CREATE_PATH}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('leaseWizard.property.addNew')}
            </Link>
          </Button>
        </div>
      )}

      {selected?.rentalMode === 'Short' ? (
        <Alert variant="warning" data-testid="lease-property-short-mode">
          {t('leaseWizard.property.shortMode')}
        </Alert>
      ) : null}

      {selected ? <PropertyRequirements key={selected.id} property={selected} needs={needs} imported={imported} /> : null}
    </div>
  );
}
