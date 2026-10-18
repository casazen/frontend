import { useId } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Clock, FileText, Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useServiceCategories } from '@/queries/use-service-categories';
import { cn } from '@/lib/utils';
import { SUPPLIER_SERVICE_WEEKDAYS, SUPPLIER_SUPPLEMENT_UNITS, type SupplierServiceWeekday } from '@/types/supplier-services';
import { FIXED_PRICE_UNITS, type ServiceFormValues } from '../lib/service-form';
import { formatDuration, formatNotice, priceUnitLabel, supplementUnitLabel, weekdayShort } from '../lib/service-labels';
import { DURATION_CHOICES, NOTICE_CHOICES, SERVICE_LIMITS } from '../lib/service-limits';

const T = 'supplier.services.form';

/** A text that says what a switch does, under it what that means. The whole row is the target (44 px), not only the switch. */
export function SwitchRow({ checked, onCheckedChange, label, hint, disabled, testId }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string; hint?: string; disabled?: boolean; testId?: string }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-3" data-testid={testId}>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block cursor-pointer break-words text-sm font-medium leading-snug">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="break-words text-sm text-foreground/70">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The category of the service, from the catalog of the API (the only values it accepts), with its own loading and error. */
function CategoryField() {
  const { t } = useTranslation();
  const { control, formState } = useFormContext<ServiceFormValues>();
  const { data: codes, isLoading, isError, refetch } = useServiceCategories();

  return (
    <Field label={t(`${T}.category.label`)} hint={t(`${T}.category.hint`)} error={formState.errors.category}>
      {(field) =>
        isLoading ? (
          <p role="status" className="text-sm text-foreground/70">
            {t('serviceCategories.loading')}
          </p>
        ) : isError || !codes ? (
          <div className="flex flex-wrap items-center gap-2 text-sm" role="alert">
            <span>{t('serviceCategories.loadError')}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              {t('serviceCategories.retry')}
            </Button>
          </div>
        ) : (
          <Controller
            control={control}
            name="category"
            render={({ field: bound }) => (
              <Select {...field} name={bound.name} ref={bound.ref} value={bound.value} onChange={(event) => bound.onChange(event.target.value)} onBlur={bound.onBlur} data-testid="service-category">
                <option value="">{t(`${T}.category.placeholder`)}</option>
                {codes.map((code) => (
                  <option key={code} value={code}>
                    {getServiceCategoryLabel(code, t)}
                  </option>
                ))}
              </Select>
            )}
          />
        )
      }
    </Field>
  );
}

/** First step: what the service is, in the words a customer reads. */
export function BasicsFields() {
  const { t } = useTranslation();
  const { register, control, formState } = useFormContext<ServiceFormValues>();
  const { errors } = formState;
  const name = useWatch({ control, name: 'name' }) ?? '';
  const summary = useWatch({ control, name: 'summary' }) ?? '';

  return (
    <div className="min-w-0 space-y-5">
      <Field label={t(`${T}.name.label`)} hint={t(`${T}.name.hint`)} example={t(`${T}.name.example`)} counter={`${name.length}/${SERVICE_LIMITS.nameMaxLength}`} error={errors.name}>
        <Input {...register('name')} maxLength={SERVICE_LIMITS.nameMaxLength} autoComplete="off" data-testid="service-name" />
      </Field>
      <CategoryField />
      <Field label={t(`${T}.summary.label`)} hint={t(`${T}.summary.hint`)} example={t(`${T}.summary.example`)} counter={`${summary.length}/${SERVICE_LIMITS.summaryMaxLength}`} error={errors.summary}>
        <Input {...register('summary')} maxLength={SERVICE_LIMITS.summaryMaxLength} autoComplete="off" data-testid="service-summary" />
      </Field>
      <Field label={t(`${T}.description.label`)} hint={t(`${T}.description.hint`)} optional error={errors.description}>
        <Textarea {...register('description')} rows={4} maxLength={SERVICE_LIMITS.descriptionMaxLength} data-testid="service-description" />
      </Field>
      <Field label={t(`${T}.included.label`)} hint={t(`${T}.included.hint`)} optional error={errors.included}>
        <Textarea {...register('included')} rows={4} data-testid="service-included" />
      </Field>
      <Field label={t(`${T}.excluded.label`)} hint={t(`${T}.excluded.hint`)} example={t(`${T}.excluded.example`)} optional error={errors.excluded}>
        <Textarea {...register('excluded')} rows={3} data-testid="service-excluded" />
      </Field>
    </div>
  );
}

/**
 * What a supplement is counted by: its own row of fields, with the one that removes it. Alone on a page it is a box of its own;
 * `flat` is for a part that already sits in a box (the page of a service): the rows are told apart by a line, not by a box in a box.
 */
function SupplementRow({ index, onRemove, flat }: { index: number; onRemove: () => void; flat: boolean }) {
  const { t } = useTranslation();
  const { register, control, formState } = useFormContext<ServiceFormValues>();
  const rowErrors = formState.errors.supplements?.[index];
  const per = useWatch({ control, name: `supplements.${index}.per` });
  const label = useWatch({ control, name: `supplements.${index}.label` }) ?? '';
  const position = index + 1;

  return (
    <li
      className={cn('min-w-0 space-y-3', flat ? 'border-t py-4 first:border-t-0 first:pt-0 last:pb-0' : 'rounded-lg bg-muted/50 p-3 ring-1 ring-inset ring-border')}
      data-testid="service-supplement"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field label={t(`${T}.supplements.label`, { number: position })} error={rowErrors?.label}>
            <Input {...register(`supplements.${index}.label`)} maxLength={SERVICE_LIMITS.supplementLabelMaxLength} autoComplete="off" placeholder={t(`${T}.supplements.labelPlaceholder`)} />
          </Field>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-[1.6rem] size-11 shrink-0 px-0 text-danger-foreground hover:text-danger-foreground"
          aria-label={t(`${T}.supplements.remove`, { number: position, name: label.trim() }).trim()}
          onClick={onRemove}
          data-testid="service-supplement-remove"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <div className={cn('grid gap-3', per === 'flat' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
        <Field label={t(`${T}.supplements.amount`)} error={rowErrors?.amount}>
          <Input {...register(`supplements.${index}.amount`)} inputMode="decimal" autoComplete="off" placeholder="10" />
        </Field>
        <Field label={t(`${T}.supplements.per`)}>
          <Select {...register(`supplements.${index}.per`)}>
            {SUPPLIER_SUPPLEMENT_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {supplementUnitLabel(unit, t)}
              </option>
            ))}
          </Select>
        </Field>
        {per === 'flat' ? null : (
          <Field label={t(`${T}.supplements.max`)} optional hint={t(`${T}.supplements.maxHint`)} error={rowErrors?.max}>
            <Input {...register(`supplements.${index}.max`)} inputMode="numeric" autoComplete="off" />
          </Field>
        )}
      </div>
    </li>
  );
}

/** The supplements of the service: created, changed and removed here, up to ten. */
function SupplementsEditor({ flat }: { flat: boolean }) {
  const { t } = useTranslation();
  const { control, formState } = useFormContext<ServiceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'supplements' });
  const rootError = formState.errors.supplements?.root ?? (formState.errors.supplements as { message?: string } | undefined);

  return (
    <section className="min-w-0 space-y-3" aria-labelledby="service-supplements-title">
      <div className="flex items-center gap-1">
        <h3 id="service-supplements-title" className="text-sm font-medium">
          {t(`${T}.supplements.title`)}
        </h3>
        <HelpTip title={t(`${T}.supplements.title`)}>{t(`${T}.supplements.tip`)}</HelpTip>
      </div>
      <p className="break-words text-sm text-foreground/70">{t(`${T}.supplements.hint`)}</p>
      {fields.length > 0 ? (
        <ul role="list" className={cn(!flat && 'space-y-3')}>
          {fields.map((field, index) => (
            <SupplementRow key={field.id} index={index} onRemove={() => remove(index)} flat={flat} />
          ))}
        </ul>
      ) : null}
      {rootError?.message ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {t(rootError.message)}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={fields.length >= SERVICE_LIMITS.maxSupplements}
        onClick={() => append({ code: '', label: '', amount: '', per: 'flat', max: '' })}
        data-testid="service-supplement-add"
      >
        <Plus aria-hidden="true" className="size-4" />
        {t(`${T}.supplements.add`)}
      </Button>
    </section>
  );
}

const PRICE_MODES = [
  { value: 'fixed', icon: Tag },
  { value: 'hourly', icon: Clock },
  { value: 'quote', icon: FileText },
] as const;

/**
 * Second step: how the supplier is paid, the amount, what is added to it, and whether it already includes VAT. `flat` is for a page
 * that puts this part in a box of its own already (the supplements are not boxes in that box).
 */
export function PriceFields({ flat = false }: { flat?: boolean }) {
  const { t } = useTranslation();
  const { register, control, formState } = useFormContext<ServiceFormValues>();
  const { errors } = formState;
  const mode = useWatch({ control, name: 'priceMode' });

  return (
    <div className="min-w-0 space-y-6">
      <ChoiceGroup legend={t(`${T}.price.modeLegend`)} legendVisible minCardWidth={11}>
        {PRICE_MODES.map(({ value, icon }) => (
          <ChoiceCard key={value} {...register('priceMode')} value={value} icon={icon} title={t(`${T}.price.modes.${value}.title`)} description={t(`${T}.price.modes.${value}.description`)} data-testid={`service-price-mode-${value}`} />
        ))}
      </ChoiceGroup>

      {mode === 'quote' ? (
        <p className="break-words text-sm text-foreground/70" data-testid="service-quote-note">
          {t(`${T}.price.quoteNote`)}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t(mode === 'hourly' ? `${T}.price.hourlyAmount` : `${T}.price.amount`)} hint={t(`${T}.price.amountHint`)} error={errors.amount}>
            {(field) => (
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-foreground/70">
                  €
                </span>
                <Input {...field} {...register('amount')} inputMode="decimal" autoComplete="off" className="pl-8" placeholder="45" data-testid="service-amount" />
              </div>
            )}
          </Field>
          {mode === 'fixed' ? (
            <Field label={t(`${T}.price.unit`)}>
              <Select {...register('fixedUnit')} data-testid="service-unit">
                {FIXED_PRICE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {priceUnitLabel(unit, t)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="self-end pb-2 text-sm text-foreground/70">{t(`${T}.price.hourlyUnit`)}</p>
          )}
        </div>
      )}

      <Controller
        control={control}
        name="pricesIncludeVat"
        render={({ field }) => (
          <SwitchRow checked={field.value} onCheckedChange={field.onChange} label={t(`${T}.price.vat.label`)} hint={t(`${T}.price.vat.hint`)} testId="service-vat" />
        )}
      />

      <SupplementsEditor flat={flat} />
    </div>
  );
}

/** The days of the week the service is offered on: seven buttons that are pressed or not, in the order of the week. */
function WeekdayChips() {
  const { t, i18n } = useTranslation();
  const { control, formState } = useFormContext<ServiceFormValues>();
  const error = formState.errors.weekdays;

  return (
    <Controller
      control={control}
      name="weekdays"
      render={({ field }) => {
        const toggle = (day: SupplierServiceWeekday) =>
          field.onChange(SUPPLIER_SERVICE_WEEKDAYS.filter((candidate) => (candidate === day ? !field.value.includes(day) : field.value.includes(candidate))));
        return (
          <div className="space-y-1.5" data-testid="service-weekdays">
            <p id="service-weekdays-label" className="text-sm font-medium leading-snug">
              {t(`${T}.weekdays.label`)}
            </p>
            <div role="group" aria-labelledby="service-weekdays-label" aria-describedby="service-weekdays-hint" className="flex flex-wrap gap-2">
              {SUPPLIER_SERVICE_WEEKDAYS.map((day) => {
                const on = field.value.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    aria-label={t(`supplier.weekday.${day}`)}
                    onClick={() => toggle(day)}
                    data-testid={`service-weekday-${day}`}
                    className={cn(
                      'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium capitalize ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'bg-primary text-primary-foreground ring-primary' : 'bg-background text-foreground ring-border hover:bg-muted',
                    )}
                  >
                    {weekdayShort(day, i18n.language)}
                  </button>
                );
              })}
            </div>
            <p id="service-weekdays-hint" className="break-words text-sm text-foreground/70">
              {t(`${T}.weekdays.hint`)}
            </p>
            {error?.message ? (
              <p role="alert" className="text-sm text-danger-foreground">
                {t(error.message)}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

/** Third step: how long the work takes, how much notice it needs and on which days it is offered. */
export function BookingFields() {
  const { t } = useTranslation();
  const { register, getValues, formState } = useFormContext<ServiceFormValues>();
  const { errors } = formState;
  const duration = getValues('durationMinutes');
  const notice = getValues('minNoticeHours');
  const durations = [...new Set([...DURATION_CHOICES, ...(duration === null ? [] : [duration])])].sort((a, b) => a - b);
  const notices = [...new Set([...NOTICE_CHOICES, ...(notice === null ? [] : [notice])])].sort((a, b) => (a === null ? -1 : b === null ? 1 : a - b));

  return (
    <div className="min-w-0 space-y-6">
      <Field label={t(`${T}.duration.label`)} hint={t(`${T}.duration.hint`)} error={errors.durationMinutes}>
        <Select {...register('durationMinutes', { setValueAs: (value) => (value === '' || value === null ? null : Number(value)) })} data-testid="service-duration">
          {duration === null ? <option value="">{t(`${T}.duration.placeholder`)}</option> : null}
          {durations.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDuration(minutes, t)}
            </option>
          ))}
        </Select>
      </Field>

      <WeekdayChips />

      <Field label={t(`${T}.notice.label`)} hint={t(`${T}.notice.hint`)} error={errors.minNoticeHours}>
        <Select {...register('minNoticeHours', { setValueAs: (value) => (value === '' || value === null ? null : Number(value)) })} data-testid="service-notice">
          {notices.map((hours) => (
            <option key={hours ?? 'default'} value={hours ?? ''}>
              {formatNotice(hours, t)}
            </option>
          ))}
        </Select>
      </Field>

      <p className="break-words text-sm text-foreground/70" data-testid="service-confirmation-note">
        {t(`${T}.booking.confirmNote`)}
      </p>
    </div>
  );
}
