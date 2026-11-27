import { House, MapPin, BedDouble, ListChecks, ClipboardList, BadgeCheck } from 'lucide-react';
import { useEffect, useMemo, type ChangeEvent } from 'react';
import {
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type Resolver,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTAINER_COLUMNS, PAGE_COLUMN } from '@/components/layout/page-columns';
import {
  propertyFormSchema,
  longRentPropertyFormSchema,
  DEFAULT_PROPERTY_TIMEZONE,
  propertyFormDefaults,
  toPropertyPayload,
} from '../schemas/property.schema';
import type { PropertyFormValues } from '../schemas/property.schema';
import { AmenityChecklist } from './amenity-checklist';
import type { CreatePropertyDto, Property } from '@/types';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ComunePicker } from '@/components/shared/comune-picker';
import { SwissLocalityPicker } from './swiss-locality-picker';
import { useCancellationPolicies } from '@/queries/use-properties';
import { getProblemMessage } from '@/lib/api-errors';
import { currencyLabel } from '@/lib/utils';
import { isDuplicateAddressError } from '../property-errors';

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const asNumber = { valueAsNumber: true } as const;

const optionalNumber = {
  setValueAs: (value: unknown) => (value === '' || value == null ? null : Number(value)),
} as const;

function timeZoneOptions(current: string | undefined): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  const others = zones.filter((zone) => zone !== DEFAULT_PROPERTY_TIMEZONE && zone !== current);
  return [...new Set([DEFAULT_PROPERTY_TIMEZONE, ...(current ? [current] : []), ...others])];
}

interface PropertyFormProps {
  property?: Property;
  onSubmit: (data: CreatePropertyDto) => void | Promise<unknown>;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * `long-rent`: the form of a landlord with long-term leases (A7-06) — no short-stay fields (slug,
   * CIN, nightly rate, guests, fees, house rules, time zone, cancellation policy). They are not sent, so the values
   * already on the property are kept as they are.
   */
  variant?: 'short-rent' | 'long-rent';
  onDirtyChange?: (dirty: boolean) => void;
}

export function PropertyForm({
  property,
  onSubmit,
  onCancel,
  isLoading,
  disabled,
  variant = 'short-rent',
  onDirtyChange,
}: PropertyFormProps) {
  const { t } = useTranslation();
  const shortStay = variant === 'short-rent';
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    setError,
    control,
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(shortStay ? propertyFormSchema : longRentPropertyFormSchema) as Resolver<PropertyFormValues>,
    defaultValues: propertyFormDefaults(property, variant),
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const submit = async (values: PropertyFormValues) => {
    try {
      await onSubmit(toPropertyPayload(values, variant));
    } catch (error) {
      if (isDuplicateAddressError(error)) {
        setError('unit', { type: 'server', message: 'property.validation.unit.duplicate' });
        return;
      }
      throw error;
    }
  };
  const currentTimezone = watch('timezone');
  const timezoneOptionElements = useMemo(
    () => timeZoneOptions(currentTimezone).map((zone) => <option key={zone} value={zone}>{zone}</option>),
    [currentTimezone],
  );

  const selectedAmenities = watch('amenities') || [];
  const comuneIstatCode = watch('comuneIstatCode') || null;
  const swissMunicipalityCode = watch('swissMunicipalityCode') || null;
  const country = watch('country');
  const currency = country === 'CH' ? 'CHF' : 'EUR';
  const swissPlaceProperty = country === 'CH' ? property : undefined;
  const swissPlaceConfirmed = !!swissPlaceProperty && !!swissMunicipalityCode;

  const onCountryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (event.target.value !== 'CH') setValue('swissMunicipalityCode', '', { shouldDirty: true });
  };

  const toggleAmenity = (amenity: string) => {
    const current = selectedAmenities;
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    setValue('amenities', updated, { shouldDirty: true });
  };

  useEffect(() => {
    setValue('currency', currency, { shouldDirty: true });
  }, [currency, setValue]);

  return (
    <form onSubmit={handleSubmit(submit)} className="@container space-y-6" noValidate>
      <div className={CONTAINER_COLUMNS}>
        <div className={PAGE_COLUMN}>
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="mb-4 border-b bg-muted/30">
              <CardTitle className="flex items-center gap-3"><House className="size-5 shrink-0 text-primary" aria-hidden="true" />{t('property.form.basicInfo.title')}</CardTitle>
              <CardDescription>{t('property.form.basicInfo.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('property.form.name')}</Label>
                <Input id="name" {...register('name')} placeholder={t('property.form.placeholder.name')} />
                <FormFieldError error={errors.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('property.form.description')}</Label>
                <Textarea id="description" {...register('description')} placeholder={t('property.form.placeholder.description')} rows={4} />
                <FormFieldError error={errors.description} />
              </div>
              {shortStay && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="slug">{t('property.slug.label')}</Label>
                    <Input
                      id="slug"
                      data-testid="property-slug-input"
                      {...register('slug')}
                      placeholder={t('property.slug.placeholder')}
                    />
                    <FormFieldError error={errors.slug} />
                    <p className="text-xs text-muted-foreground">{t('property.slug.hint')}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {shortStay && country === 'IT' && (
            <Card className="overflow-hidden rounded-2xl">
              <CardHeader className="mb-4 border-b bg-muted/30">
                <CardTitle className="flex items-center gap-3"><BadgeCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />{t('property.form.cin.title')}</CardTitle>
                <CardDescription>{t('property.form.cin.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="cinCode">{t('property.form.cin.label')}</Label>
                <Input id="cinCode" data-testid="property-cin-input" {...register('cinCode')} placeholder={t('property.form.cin.placeholder')} />
                <FormFieldError error={errors.cinCode} />
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="mb-4 border-b bg-muted/30">
              <CardTitle className="flex items-center gap-3"><MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />{t('property.form.location.title')}</CardTitle>
              <CardDescription>{t('property.form.location.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">{t('property.form.address')}</Label>
                <Input id="address" {...register('address')} placeholder={t('property.form.placeholder.address')} />
                <FormFieldError error={errors.address} />
              </div>
              {country === 'IT' ? <div className="space-y-2" data-testid="property-comune-field">
                <Label htmlFor="comune">{t('property.form.comune.label')}</Label>
                <ComunePicker
                  id="comune"
                  istatCode={comuneIstatCode}
                  fallbackName={property?.city}
                  disabled={disabled}
                  describedBy="comune-hint"
                  onChange={(comune) => {
                    setValue('comuneIstatCode', comune?.istatCode ?? '', { shouldDirty: true, shouldValidate: true });
                    if (comune) setValue('city', comune.name, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <p id="comune-hint" className="text-xs text-muted-foreground">{t('property.form.comune.hint')}</p>
                {!comuneIstatCode && property?.city && (
                  <p className="text-xs text-amber-800" data-testid="property-comune-legacy">
                    {t('property.form.comune.legacyCity', { city: property.city })}
                  </p>
                )}
                <FormFieldError error={errors.comuneIstatCode} />
              </div> : null}
              {swissPlaceProperty ? (
                <SwissPlaceField
                  control={control}
                  setValue={setValue}
                  property={swissPlaceProperty}
                  municipalityCode={swissMunicipalityCode}
                  disabled={!!disabled || !!isLoading}
                  error={errors.swissMunicipalityCode}
                />
              ) : null}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">{t('property.country')}</Label>
                  <select id="country" className={selectClassName} {...register('country', { onChange: onCountryChange })}>
                    <option value="" disabled>{t('property.form.chooseCountry')}</option>
                    <option value="IT">{t('property.country.it')}</option>
                    <option value="CH">{t('property.country.ch')}</option>
                  </select>
                  <FormFieldError error={errors.country} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t('property.currency')}</Label>
                  <Input id="currency" value={watch('currency')} readOnly disabled className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">{t('property.form.unit')}</Label>
                <Input
                  id="unit"
                  data-testid="property-unit-input"
                  maxLength={30}
                  {...register('unit')}
                  placeholder={t('property.form.placeholder.unit')}
                  aria-describedby="unit-hint"
                />
                <p id="unit-hint" className="text-xs text-muted-foreground">{t('property.form.unitHint')}</p>
                <FormFieldError error={errors.unit} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('property.form.city')}</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    readOnly={(country === 'IT' && !!comuneIstatCode) || swissPlaceConfirmed}
                    aria-describedby={
                      country === 'IT' && comuneIstatCode ? 'city-from-comune' : swissPlaceConfirmed ? 'city-from-swiss-place' : undefined
                    }
                    placeholder={t('property.form.placeholder.city')}
                  />
                  {country === 'IT' && comuneIstatCode && (
                    <p id="city-from-comune" className="text-xs text-muted-foreground">{t('property.form.comune.cityFromComune')}</p>
                  )}
                  {swissPlaceConfirmed && (
                    <p id="city-from-swiss-place" className="text-xs text-muted-foreground">{t('swissPlace.form.cityFromPlace')}</p>
                  )}
                  <FormFieldError error={errors.city} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">{t('property.form.postalCode')}</Label>
                  <Input
                    id="postalCode"
                    {...register('postalCode')}
                    readOnly={swissPlaceConfirmed}
                    aria-describedby={swissPlaceConfirmed ? 'city-from-swiss-place' : undefined}
                    placeholder={t('property.form.placeholder.postalCode')}
                  />
                  <FormFieldError error={errors.postalCode} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">{t('property.form.latitude')}</Label>
                  <Input id="latitude" type="number" step="any" {...register('latitude', { setValueAs: (value) => {
                    if (value === '' || value === null || value === undefined) return undefined;
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  }})} placeholder={t('property.form.placeholder.latitude')} />
                  <FormFieldError error={errors.latitude} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">{t('property.form.longitude')}</Label>
                  <Input id="longitude" type="number" step="any" {...register('longitude', { setValueAs: (value) => {
                    if (value === '' || value === null || value === undefined) return undefined;
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  }})} placeholder={t('property.form.placeholder.longitude')} />
                  <FormFieldError error={errors.longitude} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={PAGE_COLUMN}>
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="mb-4 border-b bg-muted/30">
              <CardTitle className="flex items-center gap-3"><BedDouble className="size-5 shrink-0 text-primary" aria-hidden="true" />{t('property.form.details.title')}</CardTitle>
              <CardDescription>{t(shortStay ? 'property.form.details.description' : 'property.form.details.longRentDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`grid gap-4 ${shortStay ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">{t('property.form.bedrooms')}</Label>
                  <Input id="bedrooms" type="number" min={0} max={100} step={1} {...register('bedrooms', asNumber)} placeholder={t('property.form.placeholder.bedrooms')} aria-describedby="bedrooms-hint" />
                  <p id="bedrooms-hint" className="text-xs text-muted-foreground">{t('property.form.bedroomsHint')}</p>
                  <FormFieldError error={errors.bedrooms} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">{t('property.form.bathrooms')}</Label>
                  <Input id="bathrooms" type="number" min={1} max={50} step={1} {...register('bathrooms', asNumber)} placeholder={t('property.form.placeholder.bathrooms')} />
                  <FormFieldError error={errors.bathrooms} />
                </div>
                {shortStay && (
                  <div className="space-y-2">
                    <Label htmlFor="maxGuests">{t('property.form.maxGuests')}</Label>
                    <Input id="maxGuests" type="number" {...register('maxGuests', asNumber)} placeholder={t('property.form.placeholder.maxGuests')} />
                    <FormFieldError error={errors.maxGuests} />
                  </div>
                )}
              </div>
              {shortStay && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nightlyRate">{t('property.form.nightlyRate')}</Label>
                    <Input id="nightlyRate" type="number" min={0} step="0.01" {...register('nightlyRate', asNumber)} placeholder={t('property.form.placeholder.nightlyRate')} />
                    <FormFieldError error={errors.nightlyRate} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cleaningFee">{t('property.form.cleaningFee', { currency: currencyLabel(currency) })}</Label>
                    <Input id="cleaningFee" type="number" min={0} step="0.01" {...register('cleaningFee', asNumber)} />
                    <FormFieldError error={errors.cleaningFee} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="damageDeposit">{t('property.form.damageDeposit', { currency: currencyLabel(currency) })}</Label>
                    <Input id="damageDeposit" type="number" min={0} step="0.01" {...register('damageDeposit', asNumber)} />
                    <FormFieldError error={errors.damageDeposit} />
                  </div>
                  <p className="col-span-3 text-xs text-muted-foreground">
                    {t(currency === 'CHF' ? 'property.form.amountsInFrancs' : 'property.form.amountsInEuro')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {shortStay && (
            <Card className="overflow-hidden rounded-2xl">
              <CardHeader className="mb-4 border-b bg-muted/30">
                <CardTitle className="flex items-center gap-3"><ClipboardList className="size-5 shrink-0 text-primary" aria-hidden="true" />{t('property.form.stayRules.title')}</CardTitle>
                <CardDescription>{t('property.form.stayRules.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="houseRules">{t('property.form.houseRules')}</Label>
                  <Textarea id="houseRules" {...register('houseRules')} placeholder={t('property.form.placeholder.houseRules')} rows={4} />
                  <FormFieldError error={errors.houseRules} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">{t('property.form.timezone')}</Label>
                    <select id="timezone" className={selectClassName} {...register('timezone')}>
                      {timezoneOptionElements}
                    </select>
                    <FormFieldError error={errors.timezone} />
                  </div>
                  <CancellationPolicyField
                    value={watch('cancellationPolicyId') ?? ''}
                    onChange={(value) => setValue('cancellationPolicyId', value, { shouldDirty: true })}
                    error={errors.cancellationPolicyId}
                  />
                </div>
                <CancellationOverrides
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                />
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="mb-4 border-b bg-muted/30">
              <CardTitle className="flex items-center gap-3"><ListChecks className="size-5 shrink-0 text-primary" aria-hidden="true" />{t('property.form.amenities.title')}</CardTitle>
              <CardDescription>{t('property.form.amenities.description')}</CardDescription>
            </CardHeader>
            <CardContent className="@container">
              <AmenityChecklist selected={selectedAmenities} onToggle={toggleAmenity} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 rounded-2xl border bg-card p-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('property.form.cancel')}</Button>
        <Button type="submit" disabled={isLoading || disabled}>
          {isLoading ? t('property.form.saving') : property ? t('property.form.update') : t('property.form.create')}
        </Button>
      </div>
    </form>
  );
}

interface SwissPlaceFieldProps {
  control: Control<PropertyFormValues>;
  setValue: UseFormSetValue<PropertyFormValues>;
  property: Property;
  municipalityCode: string | null;
  disabled: boolean;
  error?: { message?: string };
}

/**
 * The place of a house in Switzerland (E29/F01/US02/T01, NF-124), picked or confirmed from the official directory: it fills the postal
 * code, the city and the municipality (its BFS number, from which the canton follows) that every rule of the guests reads. It never
 * blocks the save: a place that is not confirmed is only asked for.
 */
function SwissPlaceField({ control, setValue, property, municipalityCode, disabled, error }: SwissPlaceFieldProps) {
  const { t } = useTranslation();
  const [postalCode, city] = useWatch({ control, name: ['postalCode', 'city'] });

  return (
    <div className="space-y-2" data-testid="property-swiss-place-field">
      <Label htmlFor="swissPlace">{t('swissPlace.form.label')}</Label>
      <SwissLocalityPicker
        id="swissPlace"
        municipalityCode={municipalityCode}
        postalCode={postalCode ?? ''}
        city={city ?? ''}
        stored={{
          municipalityCode: property.swissMunicipalityCode,
          municipalityName: property.swissMunicipalityName,
          cantonCode: property.swissCantonCode,
        }}
        disabled={disabled}
        describedBy="swiss-place-hint"
        onChange={(place) => {
          setValue('swissMunicipalityCode', place?.municipalityCode ?? '', { shouldDirty: true, shouldValidate: true });
          if (place) {
            setValue('city', place.name, { shouldDirty: true, shouldValidate: true });
            setValue('postalCode', place.postalCode, { shouldDirty: true, shouldValidate: true });
          }
        }}
      />
      <p id="swiss-place-hint" className="text-xs text-muted-foreground">{t('swissPlace.form.hint')}</p>
      <FormFieldError error={error} />
    </div>
  );
}

interface CancellationPolicyFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: { message?: string };
}

function CancellationPolicyField({ value, onChange, error }: CancellationPolicyFieldProps) {
  const { t } = useTranslation();
  const policies = useCancellationPolicies();
  const options = policies.data ?? [];
  const selected = options.find((policy) => policy.id === value);
  const unlistedValue = value !== '' && !selected;

  return (
    <div className="space-y-2">
      <Label htmlFor="cancellationPolicyId">{t('property.form.cancellationPolicy.label')}</Label>
      <select
        id="cancellationPolicyId"
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={policies.isLoading || policies.isError}
        aria-busy={policies.isLoading}
      >
        <option value="">{t('property.form.cancellationPolicy.none')}</option>
        {unlistedValue && <option value={value}>{t('property.form.cancellationPolicy.current')}</option>}
        {options.map((policy) => (
          <option key={policy.id} value={policy.id}>{policy.name}</option>
        ))}
      </select>
      {policies.isLoading && (
        <p className="text-xs text-muted-foreground">{t('property.form.cancellationPolicy.loading')}</p>
      )}
      {policies.isError && (
        <p role="alert" className="text-sm text-destructive" data-testid="cancellation-policies-error">
          {getProblemMessage(policies.error, t) ?? t('property.form.cancellationPolicy.loadError')}
        </p>
      )}
      {!policies.isLoading && !policies.isError && options.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('property.form.cancellationPolicy.empty')}</p>
      )}
      {selected?.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
      <FormFieldError error={error} />
    </div>
  );
}

interface CancellationOverridesProps {
  register: UseFormRegister<PropertyFormValues>;
  watch: UseFormWatch<PropertyFormValues>;
  setValue: UseFormSetValue<PropertyFormValues>;
  errors: FieldErrors<PropertyFormValues>;
}

function CancellationOverrides({ register, watch, setValue, errors }: CancellationOverridesProps) {
  const { t } = useTranslation();
  const refundType = watch('cancellationRefundType') ?? 'Percent';

  return (
    <div className="space-y-3" data-testid="cancellation-overrides">
      <p className="text-sm font-medium">{t('property.form.cancellationPolicy.customize')}</p>
      <p className="text-xs text-muted-foreground">{t('property.form.cancellationPolicy.longStayHint')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cancellationFullRefundHours">{t('property.form.cancellationPolicy.fullRefundHours')}</Label>
          <Input
            id="cancellationFullRefundHours"
            type="number"
            min={0}
            step={1}
            {...register('cancellationFullRefundHours', optionalNumber)}
          />
          <FormFieldError error={errors.cancellationFullRefundHours} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cancellationPartialRefundHours">{t('property.form.cancellationPolicy.partialRefundHours')}</Label>
          <Input
            id="cancellationPartialRefundHours"
            type="number"
            min={0}
            step={1}
            {...register('cancellationPartialRefundHours', optionalNumber)}
          />
          <FormFieldError error={errors.cancellationPartialRefundHours} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cancellationPartialRefundPercent">{t('property.form.cancellationPolicy.partialPercent')}</Label>
          <Input
            id="cancellationPartialRefundPercent"
            type="number"
            min={0}
            max={100}
            step={1}
            {...register('cancellationPartialRefundPercent', optionalNumber)}
          />
          <FormFieldError error={errors.cancellationPartialRefundPercent} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cancellationRefundType">{t('property.form.cancellationPolicy.refundType')}</Label>
        <select
          id="cancellationRefundType"
          className={selectClassName}
          value={refundType}
          onChange={(event) =>
            setValue('cancellationRefundType', event.target.value as 'Percent' | 'NonRefundable', { shouldDirty: true })
          }
        >
          <option value="Percent">{t('property.form.cancellationPolicy.percent')}</option>
          <option value="NonRefundable">{t('property.form.cancellationPolicy.nonRefundable')}</option>
        </select>
      </div>
    </div>
  );
}
