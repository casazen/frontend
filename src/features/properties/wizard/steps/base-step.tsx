import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Building2, Home, Landmark, Layers, BedDouble, type LucideIcon } from 'lucide-react';
import { ComunePicker } from '@/components/shared/comune-picker';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Qty } from '@/components/ui/qty';
import { ACCOMMODATION_TYPES, type AccommodationType } from '@/types';
import type { PropertyWizardValues } from '../property-wizard-model';

const TYPE_ICONS: Record<AccommodationType, LucideIcon> = {
  Apartment: Building2,
  HouseOrVilla: Home,
  TrulloOrMasseria: Landmark,
  LoftOrPenthouse: Layers,
  RoomOrSuite: BedDouble,
};

type SpaceName = 'maxGuests' | 'bedrooms' | 'beds' | 'bathrooms';

const SPACES: ReadonlyArray<{ name: SpaceName; min: number; max: number }> = [
  { name: 'maxGuests', min: 1, max: 100 },
  { name: 'bedrooms', min: 0, max: 100 },
  { name: 'beds', min: 1, max: 100 },
  { name: 'bathrooms', min: 1, max: 50 },
];

interface SpaceRowProps {
  form: UseFormReturn<PropertyWizardValues>;
  name: SpaceName;
  min: number;
  max: number;
}

/** One counter of the spaces: the name and what it counts on the left, the two buttons on the right. */
function SpaceRow({ form, name, min, max }: SpaceRowProps) {
  const { t } = useTranslation();
  const label = t(`propertyWizard.base.spaces.${name}.label`);

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="flex min-w-0 items-center justify-between gap-4">
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

interface BaseStepProps {
  form: UseFormReturn<PropertyWizardValues>;
}

/**
 * Step 1 · «Che casa stai aggiungendo?» (SR-07b): the kind of accommodation, the name, where it is (the comune from the official
 * list) and its spaces. «Avanti» creates the property on the server. No map: without a geocoder a pin would be made up.
 */
export function BaseStep({ form }: BaseStepProps) {
  const { t } = useTranslation();
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const comuneIstatCode = watch('comuneIstatCode') || null;

  return (
    <>
      <ChoiceGroup legend={t('propertyWizard.base.type.legend')} legendVisible minCardWidth={9}>
        {ACCOMMODATION_TYPES.map((type) => (
          <ChoiceCard
            key={type}
            type="radio"
            value={type}
            icon={TYPE_ICONS[type]}
            title={t(`propertyWizard.base.type.options.${type}`)}
            {...register('accommodationType')}
          />
        ))}
      </ChoiceGroup>

      <Field label={t('propertyWizard.base.name.label')} hint={t('propertyWizard.base.name.hint')} error={errors.name}>
        <Input autoComplete="off" maxLength={100} placeholder={t('propertyWizard.base.name.placeholder')} {...register('name')} />
      </Field>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Field label={t('propertyWizard.base.address.label')} hint={t('propertyWizard.base.address.hint')} error={errors.address}>
          <Input autoComplete="street-address" placeholder={t('propertyWizard.base.address.placeholder')} {...register('address')} />
        </Field>
        <Field label={t('propertyWizard.base.comune.label')} hint={t('propertyWizard.base.comune.hint')} error={errors.city ?? errors.comuneIstatCode}>
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
              // Without the official list there is nothing to choose from: the city is written, as in the form of today.
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
        </Field>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Field label={t('propertyWizard.base.unit.label')} optional hint={t('propertyWizard.base.unit.hint')} error={errors.unit}>
          <Input autoComplete="off" maxLength={30} {...register('unit')} />
        </Field>
        <Field label={t('propertyWizard.base.postalCode.label')} optional error={errors.postalCode}>
          <Input inputMode="numeric" autoComplete="postal-code" maxLength={5} {...register('postalCode')} />
        </Field>
      </div>

      <section aria-labelledby="property-wizard-spaces" className="min-w-0 space-y-4">
        <h3 id="property-wizard-spaces" className="text-base font-semibold">
          {t('propertyWizard.base.spaces.title')}
        </h3>
        {SPACES.map((space) => (
          <SpaceRow key={space.name} form={form} {...space} />
        ))}
        <Field label={t('propertyWizard.base.areaSqm.label')} optional hint={t('propertyWizard.base.areaSqm.hint')} error={errors.areaSqm} className="max-w-xs">
          <Input inputMode="numeric" autoComplete="off" maxLength={4} {...register('areaSqm')} />
        </Field>
      </section>
    </>
  );
}
