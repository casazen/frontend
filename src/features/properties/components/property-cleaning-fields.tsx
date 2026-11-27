import { useTranslation } from 'react-i18next';
import { Building2, UserRound } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  CLEANING_DEFAULT_DURATION,
  CLEANING_MAX_DURATION,
  CLEANING_MIN_DURATION,
  SUPPLIER_CURRENCY,
  type CleaningForm,
  type CleaningProblems,
  type CleaningTimeSource,
  type SupplierChoice,
} from '../lib/property-cleaning-model';

export interface StaffChoice {
  userId: string;
  name: string;
}

export type ChoicesState = 'loading' | 'ready' | 'error' | 'unavailable';

interface PropertyCleaningFieldsProps {
  idPrefix: string;
  form: CleaningForm;
  onChange: (patch: Partial<CleaningForm>) => void;
  problems: CleaningProblems;
  currency: string;
  suppliers: { state: ChoicesState; choices: SupplierChoice[]; storedName: string | null; onRetry: () => void };
  staff: { state: ChoicesState; choices: StaffChoice[]; onRetry: () => void };
  timeSource: CleaningTimeSource | null;
  disabled: boolean;
}

export function PropertyCleaningFields({ idPrefix, form, onChange, problems, currency, suppliers, staff, timeSource, disabled }: PropertyCleaningFieldsProps) {
  const { t } = useTranslation();
  const supplierWorks = currency === SUPPLIER_CURRENCY;
  const currencyKnown = /^[A-Z]{3}$/.test(currency);
  const supplierMissing = form.supplierOrgId !== '' && !suppliers.choices.some((choice) => choice.id === form.supplierOrgId);
  const staffMissing = form.staffUserId !== '' && !staff.choices.some((choice) => choice.userId === form.staffUserId);

  return (
    <div className="space-y-4">
      <ChoiceGroup legend={t('propertyCleaning.fields.kind')} legendVisible minCardWidth={14}>
        <ChoiceCard
          name={`${idPrefix}-kind`}
          value="Supplier"
          checked={form.kind === 'Supplier'}
          disabled={disabled || (!supplierWorks && form.kind !== 'Supplier')}
          onChange={() => onChange({ kind: 'Supplier' })}
          icon={Building2}
          title={t('propertyCleaning.kind.supplier.title')}
          description={supplierWorks ? t('propertyCleaning.kind.supplier.description') : t('propertyCleaning.kind.supplier.euroOnly', { currency })}
          data-testid={`${idPrefix}-kind-supplier`}
        />
        <ChoiceCard
          name={`${idPrefix}-kind`}
          value="Staff"
          checked={form.kind === 'Staff'}
          disabled={disabled}
          onChange={() => onChange({ kind: 'Staff' })}
          icon={UserRound}
          title={t('propertyCleaning.kind.staff.title')}
          description={t('propertyCleaning.kind.staff.description')}
          data-testid={`${idPrefix}-kind-staff`}
        />
      </ChoiceGroup>

      {form.kind === 'Supplier' ? (
        <div className="space-y-2">
          <Field
            label={t('propertyCleaning.fields.supplier')}
            error={problems.cleaner}
            hint={suppliers.state === 'ready' && suppliers.choices.length === 0 ? t('propertyCleaning.suppliers.none') : undefined}
          >
            <Select
              value={form.supplierOrgId}
              disabled={disabled || suppliers.state === 'loading'}
              onChange={(event) => onChange({ supplierOrgId: event.target.value })}
              data-testid={`${idPrefix}-supplier`}
            >
              <option value="">{suppliers.state === 'loading' ? t('propertyCleaning.suppliers.loading') : t('propertyCleaning.suppliers.choose')}</option>
              {supplierMissing ? <option value={form.supplierOrgId}>{suppliers.storedName ?? t('propertyCleaning.suppliers.stored')}</option> : null}
              {suppliers.choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.covers === null ? choice.name : t('propertyCleaning.suppliers.covers', { name: choice.name, count: choice.covers })}{choice.hostOrigin !== undefined && ` · ${t(choice.hostOrigin ? 'supplier.trusted.privateSupplier' : 'supplier.trusted.marketplace')}`}
                </option>
              ))}
            </Select>
          </Field>
          {suppliers.state === 'error' ? (
            <Alert
              variant="warning"
              data-testid={`${idPrefix}-suppliers-error`}
              action={
                <Button type="button" variant="outline" size="sm" onClick={suppliers.onRetry}>
                  {t('propertyCleaning.retry')}
                </Button>
              }
            >
              {t('propertyCleaning.suppliers.loadError')}
            </Alert>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <Field
            label={t('propertyCleaning.fields.staff')}
            error={problems.cleaner}
            hint={staff.state === 'unavailable' ? t('propertyCleaning.staff.needsTeamPermission') : staff.state === 'ready' && staff.choices.length === 0 ? t('propertyCleaning.staff.none') : undefined}
          >
            <Select
              value={form.staffUserId}
              disabled={disabled || staff.state === 'loading'}
              onChange={(event) => onChange({ staffUserId: event.target.value })}
              data-testid={`${idPrefix}-staff`}
            >
              <option value="">{staff.state === 'loading' ? t('propertyCleaning.staff.loading') : t('propertyCleaning.staff.choose')}</option>
              {staffMissing ? <option value={form.staffUserId}>{t('propertyCleaning.staff.stored')}</option> : null}
              {staff.choices.map((choice) => (
                <option key={choice.userId} value={choice.userId}>
                  {choice.name}
                </option>
              ))}
            </Select>
          </Field>
          {staff.state === 'error' ? (
            <Alert
              variant="warning"
              data-testid={`${idPrefix}-staff-error`}
              action={
                <Button type="button" variant="outline" size="sm" onClick={staff.onRetry}>
                  {t('propertyCleaning.retry')}
                </Button>
              }
            >
              {t('propertyCleaning.staff.loadError')}
            </Alert>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={currencyKnown ? t('propertyCleaning.fields.priceIn', { currency }) : t('propertyCleaning.fields.price')}
          optional={form.kind === 'Staff'}
          error={problems.price}
          hint={currencyKnown ? (form.kind === 'Staff' ? t('propertyCleaning.hints.priceStaff', { currency }) : t('propertyCleaning.hints.price', { currency })) : t('propertyCleaning.hints.noCurrency')}
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={form.price}
            disabled={disabled || !currencyKnown}
            onChange={(event) => onChange({ price: event.target.value })}
            data-testid={`${idPrefix}-price`}
          />
        </Field>

        <Field
          label={t('propertyCleaning.fields.time')}
          optional
          error={problems.time}
          hint={
            timeSource
              ? t(timeSource.kind === 'property' ? 'propertyCleaning.hints.timeProperty' : 'propertyCleaning.hints.timeDefault', { time: timeSource.time })
              : t('propertyCleaning.hints.time')
          }
        >
          <Input type="time" step={300} value={form.time} disabled={disabled} onChange={(event) => onChange({ time: event.target.value })} data-testid={`${idPrefix}-time`} />
        </Field>

        <Field
          label={t('propertyCleaning.fields.duration')}
          optional
          error={problems.duration}
          hint={t('propertyCleaning.hints.duration', { min: CLEANING_MIN_DURATION, max: CLEANING_MAX_DURATION, default: CLEANING_DEFAULT_DURATION })}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={CLEANING_MIN_DURATION}
            max={CLEANING_MAX_DURATION}
            step={5}
            value={form.duration}
            disabled={disabled}
            onChange={(event) => onChange({ duration: event.target.value })}
            data-testid={`${idPrefix}-duration`}
          />
        </Field>
      </div>

      <div className={cn('flex items-start justify-between gap-4')}>
        <div className="min-w-0 space-y-0.5">
          <label htmlFor={`${idPrefix}-active`} className="text-sm font-medium">
            {t('propertyCleaning.fields.active')}
          </label>
          <p className="text-sm text-foreground/70">{form.active ? t('propertyCleaning.hints.activeOn') : t('propertyCleaning.hints.activeOff')}</p>
        </div>
        <Switch id={`${idPrefix}-active`} checked={form.active} disabled={disabled} onCheckedChange={(active) => onChange({ active })} data-testid={`${idPrefix}-active`} />
      </div>
    </div>
  );
}
