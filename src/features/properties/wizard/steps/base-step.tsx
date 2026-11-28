import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ComunePicker } from '@/components/shared/comune-picker';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Qty } from '@/components/ui/qty';
import { ACCOMMODATION_TYPES } from '@/types';
import type { PropertyWizardValues } from '../property-wizard-model';
import { RoomsEditor } from './rooms-editor';

const SELECT_CLASS = 'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3';

type SpaceName = 'maxGuests' | 'bedrooms' | 'beds' | 'bathrooms';

const SPACES: ReadonlyArray<{ name: SpaceName; min: number; max: number }> = [
  { name: 'maxGuests', min: 1, max: 100 },
  { name: 'bedrooms', min: 0, max: 100 },
  { name: 'beds', min: 1, max: 100 },
  { name: 'bathrooms', min: 1, max: 50 },
];

/**
 * The counters of the spaces side by side, by the width of the step (a container: the same step is narrow on a phone and very wide beside
 * the steps of a large screen): one under the other, then two per row, then all four in a row as small tiles. A counter never sits at the far
 * end of a line that runs across the whole screen, away from the name it counts.
 */
const SPACE_GRID = 'grid grid-cols-1 gap-x-8 gap-y-4 @2xl:grid-cols-2 @5xl:grid-cols-4 @5xl:gap-4';

const SPACE_ITEM =
  'flex min-w-0 items-center justify-between gap-4 @5xl:flex-col @5xl:items-start @5xl:justify-between @5xl:gap-3 @5xl:rounded-lg @5xl:p-4 @5xl:ring-1 @5xl:ring-inset @5xl:ring-border';

interface SpaceRowProps {
  form: UseFormReturn<PropertyWizardValues>;
  name: SpaceName;
  min: number;
  max: number;
}

function SpaceRow({ form, name, min, max }: SpaceRowProps) {
  const { t } = useTranslation();
  const label = t(`propertyWizard.base.spaces.${name}.label`);

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className={SPACE_ITEM}>
          <div className="min-w-0">
            <div className="font-medium">{label}</div>
            <div className="text-sm text-foreground/70">{t(`propertyWizard.base.spaces.${name}.hint`)}</div>
          </div>
          <Qty
            label={label}
            value={field.value}
            onChange={field.onChange}
            min={min}
            max={max}
            testId={`property-wizard-${name}`}
          />
        </div>
      )}
    />
  );
}

function DerivedRow({ name, value }: { name: 'bedrooms' | 'beds'; value: number }) {
  const { t } = useTranslation();

  return (
    <div className={SPACE_ITEM} data-testid={`property-wizard-${name}-derived`}>
      <div className="min-w-0">
        <div className="font-medium">{t(`propertyWizard.base.spaces.${name}.label`)}</div>
        <div className="text-sm text-foreground/70">{t('propertyWizard.base.spaces.fromRooms')}</div>
      </div>
      <output className="min-w-[2.5ch] text-center text-lg font-semibold tabular-nums" aria-label={t(`propertyWizard.base.spaces.${name}.label`)}>
        {value}
      </output>
    </div>
  );
}

interface BaseStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  storedRoomCount?: number;
}

export function BaseStep({ form, storedRoomCount = 0 }: BaseStepProps) {
  const { t } = useTranslation();
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const comuneIstatCode = watch('comuneIstatCode') || null;
  const country = watch('country');
  const hasRooms = watch('rooms').length > 0;

  return (
    <>
      <Field label={t('propertyWizard.base.name.label')} hint={t('propertyWizard.base.name.hint')} error={errors.name}>
        <Input autoComplete="off" maxLength={100} placeholder={t('propertyWizard.base.name.placeholder')} {...register('name')} />
      </Field>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Field label={t('propertyWizard.base.type.legend')} error={errors.accommodationType}>
          <select className={SELECT_CLASS} {...register('accommodationType')}>
            <option value="">{t('propertySetup.unspecifiedType')}</option>
            {ACCOMMODATION_TYPES.map(type => <option key={type} value={type}>{t(`propertyWizard.base.type.options.${type}`)}</option>)}
          </select>
        </Field>
        <Field label={t('property.country')} error={errors.country}>
          <select className={SELECT_CLASS} {...register('country')}>
            <option value="" disabled>{t('property.form.chooseCountry')}</option>
            <option value="IT">{t('property.country.it')}</option>
            <option value="CH">{t('property.country.ch')}</option>
          </select>
        </Field>
      </div>

      <fieldset className="min-w-0 space-y-4 rounded-2xl border bg-muted/20 p-4">
        <legend className="px-2 font-semibold">{t('property.form.location.title')}</legend>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Field label={t('propertyWizard.base.address.label')} hint={t('propertyWizard.base.address.hint')} error={errors.address}>
            <Input autoComplete="street-address" placeholder={t('propertyWizard.base.address.placeholder')} {...register('address')} />
          </Field>
          {country === 'IT' ? <Field label={t('propertyWizard.base.comune.label')} hint={t('propertyWizard.base.comune.hint')} error={errors.city ?? errors.comuneIstatCode}>
            {(control) => (
              <ComunePicker
                id={control.id}
                istatCode={comuneIstatCode}
                describedBy={control['aria-describedby']}
                invalid={control['aria-invalid'] === true}
                fallbackName={form.getValues('city') || null}
                onChange={(comune) => {
                  setValue('comuneIstatCode', comune?.istatCode ?? '', { shouldValidate: true, shouldDirty: true });
                  setValue('city', comune?.name ?? '', { shouldValidate: true, shouldDirty: true });
                }}
                unavailableFallback={
                  <Input
                    aria-label={t('propertyWizard.base.comune.fallbackLabel')}
                    autoComplete="address-level2"
                    placeholder={t('propertyWizard.base.comune.fallbackPlaceholder')}
                    {...register('city')}
                  />
                }
              />
            )}
          </Field> : <Field label={t('property.form.city')} error={errors.city}>
            <Input autoComplete="address-level2" {...register('city')} />
          </Field>}
        </div>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Field label={t('propertyWizard.base.unit.label')} optional hint={t('propertyWizard.base.unit.hint')} error={errors.unit}>
            <Input autoComplete="off" maxLength={30} {...register('unit')} />
          </Field>
          <Field label={t('propertyWizard.base.postalCode.label')} optional error={errors.postalCode}>
            <Input inputMode="numeric" autoComplete="postal-code" maxLength={5} {...register('postalCode')} />
          </Field>
        </div>

      </fieldset>

      <section aria-labelledby="property-wizard-spaces" className="min-w-0 space-y-4">
        <h3 id="property-wizard-spaces" className="text-base font-semibold">
          {t('propertyWizard.base.spaces.title')}
        </h3>
        <div className="@container min-w-0">
          <div className={SPACE_GRID} data-testid="property-wizard-spaces-grid">
            {SPACES.map((space) =>
              hasRooms && (space.name === 'bedrooms' || space.name === 'beds') ? (
                <DerivedRow key={space.name} name={space.name} value={watch(space.name)} />
              ) : (
                <SpaceRow key={space.name} form={form} {...space} />
              ),
            )}
          </div>
        </div>
        <Field label={t('propertyWizard.base.areaSqm.label')} optional hint={t('propertyWizard.base.areaSqm.hint')} error={errors.areaSqm} className="max-w-xs">
          <Input inputMode="numeric" autoComplete="off" maxLength={4} {...register('areaSqm')} />
        </Field>
      </section>

      <RoomsEditor form={form} storedRoomCount={storedRoomCount} />
    </>
  );
}
