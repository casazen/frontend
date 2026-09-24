import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  propertyFormSchema,
  longRentPropertyFormSchema,
  COMMON_AMENITIES,
  DEFAULT_PROPERTY_TIMEZONE,
  propertyFormDefaults,
  toPropertyPayload,
} from '../schemas/property.schema';
import { getAmenityLabel } from '@/lib/i18n-labels';
import type { PropertyFormValues } from '../schemas/property.schema';
import type { CreatePropertyDto, Property } from '@/types';
import { FormFieldError } from '@/components/shared/form-field-error';
import { useCancellationPolicies } from '@/queries/use-properties';
import { getProblemMessage } from '@/lib/api-errors';

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Number inputs: an empty field is NaN, reported by the schema with the field's own message. */
const asNumber = { valueAsNumber: true } as const;

/** IANA time zones of the browser, Europe/Rome first; the current value is always an option. */
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
  /** The API body: every field the form shows (the update keeps the others, A2-04). */
  onSubmit: (data: CreatePropertyDto) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * `long-rent`: the form of a landlord with long-term leases (A7-06) — no short-stay fields (listing status, slug,
   * CIN, nightly rate, guests, fees, house rules, time zone, cancellation policy). They are not sent, so the values
   * already on the property are kept as they are.
   */
  variant?: 'short-rent' | 'long-rent';
  /** Called when the form gets or loses unsaved changes (the activation wizard keeps them across its steps). */
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
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(shortStay ? propertyFormSchema : longRentPropertyFormSchema),
    defaultValues: propertyFormDefaults(property, variant),
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const submit = (values: PropertyFormValues) => onSubmit(toPropertyPayload(values, variant));
  const currentTimezone = watch('timezone');
  // Same option elements between renders: the ~400 zones are not re-rendered at every keystroke.
  const timezoneOptionElements = useMemo(
    () => timeZoneOptions(currentTimezone).map((zone) => <option key={zone} value={zone}>{zone}</option>),
    [currentTimezone],
  );

  const selectedAmenities = watch('amenities') || [];

  const toggleAmenity = (amenity: string) => {
    const current = selectedAmenities;
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    setValue('amenities', updated, { shouldDirty: true });
  };

  // noValidate: the schema validates with translated messages; min/step only drive the number spinners.
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t('property.form.basicInfo.title')}</CardTitle>
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
              <div className="flex items-center space-x-2">
                <Checkbox id="isActive" checked={watch('isActive')} onCheckedChange={(checked) => setValue('isActive', !!checked, { shouldDirty: true })} />
                <Label htmlFor="isActive" className="cursor-pointer">{t('property.form.isActive')}</Label>
              </div>

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

      {shortStay && (
        <Card>
          <CardHeader>
            <CardTitle>{t('property.form.cin.title')}</CardTitle>
            <CardDescription>{t('property.form.cin.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="cinCode">{t('property.form.cin.label')}</Label>
            <Input id="cinCode" data-testid="property-cin-input" {...register('cinCode')} placeholder={t('property.form.cin.placeholder')} />
            <FormFieldError error={errors.cinCode} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('property.form.location.title')}</CardTitle>
          <CardDescription>{t('property.form.location.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">{t('property.form.address')}</Label>
            <Input id="address" {...register('address')} placeholder={t('property.form.placeholder.address')} />
            <FormFieldError error={errors.address} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t('property.form.city')}</Label>
              <Input id="city" {...register('city')} placeholder={t('property.form.placeholder.city')} />
              <FormFieldError error={errors.city} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t('property.form.postalCode')}</Label>
              <Input id="postalCode" {...register('postalCode')} placeholder={t('property.form.placeholder.postalCode')} />
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">{t('property.form.longitude')}</Label>
              <Input id="longitude" type="number" step="any" {...register('longitude', { setValueAs: (value) => {
                if (value === '' || value === null || value === undefined) return undefined;
                const parsed = Number(value);
                return Number.isNaN(parsed) ? undefined : parsed;
              }})} placeholder={t('property.form.placeholder.longitude')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('property.form.details.title')}</CardTitle>
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
                <Label htmlFor="cleaningFee">{t('property.form.cleaningFee')}</Label>
                <Input id="cleaningFee" type="number" min={0} step="0.01" {...register('cleaningFee', asNumber)} />
                <FormFieldError error={errors.cleaningFee} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="damageDeposit">{t('property.form.damageDeposit')}</Label>
                <Input id="damageDeposit" type="number" min={0} step="0.01" {...register('damageDeposit', asNumber)} />
                <FormFieldError error={errors.damageDeposit} />
              </div>
              <p className="col-span-3 text-xs text-muted-foreground">{t('property.form.amountsInEuro')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {shortStay && (
        <Card>
          <CardHeader>
            <CardTitle>{t('property.form.stayRules.title')}</CardTitle>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('property.form.amenities.title')}</CardTitle>
          <CardDescription>{t('property.form.amenities.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {COMMON_AMENITIES.map((amenity) => (
              <div key={amenity} className="flex items-center space-x-2">
                <Checkbox id={`amenity-${amenity}`} checked={selectedAmenities.includes(amenity)} onCheckedChange={() => toggleAmenity(amenity)} />
                <Label htmlFor={`amenity-${amenity}`} className="cursor-pointer text-sm">{getAmenityLabel(amenity, t)}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>{t('property.form.cancel')}</Button>
        <Button type="submit" disabled={isLoading || disabled}>
          {isLoading ? t('property.form.saving') : property ? t('property.form.update') : t('property.form.create')}
        </Button>
      </div>
    </form>
  );
}

interface CancellationPolicyFieldProps {
  /** Selected policy id, '' for none. */
  value: string;
  onChange: (value: string) => void;
  error?: { message?: string };
}

/**
 * Cancellation policy of the property, from the policies of the API. The select is controlled, so the value never
 * changes while the options load; a load error is shown as such (never as "no policy") and the value is kept.
 */
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
