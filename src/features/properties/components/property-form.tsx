import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { propertyFormSchema, COMMON_AMENITIES } from '../schemas/property.schema';
import { getAmenityLabel } from '@/lib/i18n-labels';
import type { PropertyFormValues } from '../schemas/property.schema';
import type { Property } from '@/types';

interface PropertyFormProps {
  property?: Property;
  onSubmit: (data: PropertyFormValues) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PropertyForm({ property, onSubmit, onCancel, isLoading, disabled }: PropertyFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: property ? {
      name: property.name,
      description: property.description,
      address: property.address,
      city: property.city,
      country: property.country || 'IT',
      postalCode: property.postalCode,
      latitude: property.latitude,
      longitude: property.longitude,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      maxGuests: property.maxGuests,
      nightlyRate: property.nightlyRate,
      currency: property.currency || 'EUR',
      amenities: property.amenities || [],
      photoUrls: property.photoUrls || [],
      isActive: property.isActive,
      cinCode: property.cinCode ?? '',
      slug: property.slug ?? '',
    } : {
      country: 'IT',
      currency: 'EUR',
      amenities: [],
      photoUrls: [],
      isActive: true,
      cinCode: '',
      slug: '',
    } satisfies Partial<PropertyFormValues>,
  });

  const selectedAmenities = watch('amenities') || [];

  const toggleAmenity = (amenity: string) => {
    const current = selectedAmenities;
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    setValue('amenities', updated);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('property.form.basicInfo.title')}</CardTitle>
          <CardDescription>{t('property.form.basicInfo.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('property.form.name')}</Label>
            <Input id="name" {...register('name')} placeholder={t('property.form.placeholder.name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('property.form.description')}</Label>
            <Textarea id="description" {...register('description')} placeholder={t('property.form.placeholder.description')} rows={4} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="isActive" checked={watch('isActive')} onCheckedChange={(checked) => setValue('isActive', !!checked)} />
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
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            <p className="text-xs text-muted-foreground">{t('property.slug.hint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('property.form.cin.title')}</CardTitle>
          <CardDescription>{t('property.form.cin.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="cinCode">{t('property.form.cin.label')}</Label>
          <Input id="cinCode" data-testid="property-cin-input" {...register('cinCode')} placeholder={t('property.form.cin.placeholder')} />
          {errors.cinCode && <p className="text-sm text-destructive">{errors.cinCode.message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('property.form.location.title')}</CardTitle>
          <CardDescription>{t('property.form.location.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">{t('property.form.address')}</Label>
            <Input id="address" {...register('address')} placeholder={t('property.form.placeholder.address')} />
            {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t('property.form.city')}</Label>
              <Input id="city" {...register('city')} placeholder={t('property.form.placeholder.city')} />
              {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t('property.form.country')}</Label>
              <Input id="country" {...register('country')} placeholder={t('property.form.placeholder.country')} />
              {errors.country && <p className="text-sm text-destructive">{errors.country.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t('property.form.postalCode')}</Label>
              <Input id="postalCode" {...register('postalCode')} placeholder={t('property.form.placeholder.postalCode')} />
              {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode.message}</p>}
            </div>
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
          <CardDescription>{t('property.form.details.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">{t('property.form.bedrooms')}</Label>
              <Input id="bedrooms" type="number" {...register('bedrooms', { valueAsNumber: true })} placeholder={t('property.form.placeholder.bedrooms')} />
              {errors.bedrooms && <p className="text-sm text-destructive">{errors.bedrooms.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">{t('property.form.bathrooms')}</Label>
              <Input id="bathrooms" type="number" step="0.5" {...register('bathrooms', { valueAsNumber: true })} placeholder={t('property.form.placeholder.bathrooms')} />
              {errors.bathrooms && <p className="text-sm text-destructive">{errors.bathrooms.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxGuests">{t('property.form.maxGuests')}</Label>
              <Input id="maxGuests" type="number" {...register('maxGuests', { valueAsNumber: true })} placeholder={t('property.form.placeholder.maxGuests')} />
              {errors.maxGuests && <p className="text-sm text-destructive">{errors.maxGuests.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nightlyRate">{t('property.form.nightlyRate')}</Label>
              <Input id="nightlyRate" type="number" step="0.01" {...register('nightlyRate', { valueAsNumber: true })} placeholder={t('property.form.placeholder.nightlyRate')} />
              {errors.nightlyRate && <p className="text-sm text-destructive">{errors.nightlyRate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">{t('property.form.currency')}</Label>
              <Input id="currency" {...register('currency')} placeholder={t('property.form.placeholder.currency')} />
            </div>
          </div>
        </CardContent>
      </Card>

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
