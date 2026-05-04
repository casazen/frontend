import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { propertyFormSchema, COMMON_AMENITIES } from '../schemas/property.schema';
import type { PropertyFormValues } from '../schemas/property.schema';
import type { Property } from '@/types';

interface PropertyFormProps {
  property?: Property;
  onSubmit: (data: PropertyFormValues) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PropertyForm({ property, onSubmit, onCancel, isLoading }: PropertyFormProps) {
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
      country: property.country,
      postalCode: property.postalCode,
      latitude: property.latitude,
      longitude: property.longitude,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      maxGuests: property.maxGuests,
      nightlyRate: property.nightlyRate,
      currency: property.currency,
      amenities: property.amenities || [],
      photoUrls: property.photoUrls || [],
      isActive: property.isActive,
    } : {
      currency: 'EUR',
      amenities: [],
      photoUrls: [],
      isActive: true,
    } as any,
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
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>General details about the property</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Property Name *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Beautiful Beach House"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Describe your property..."
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={watch('isActive')}
              onCheckedChange={(checked) => setValue('isActive', !!checked)}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active (visible to guests)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Where is the property located?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="123 Main Street"
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                {...register('city')}
                placeholder="Miami"
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                {...register('country')}
                placeholder="USA"
              />
              {errors.country && (
                <p className="text-sm text-destructive">{errors.country.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">ZIP Code *</Label>
              <Input
                id="postalCode"
                {...register('postalCode')}
                placeholder="33101"
              />
              {errors.postalCode && (
                <p className="text-sm text-destructive">{errors.postalCode.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                {...register('latitude', { valueAsNumber: true })}
                placeholder="25.7617"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                {...register('longitude', { valueAsNumber: true })}
                placeholder="-80.1918"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
          <CardDescription>Capacity and pricing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms *</Label>
              <Input
                id="bedrooms"
                type="number"
                {...register('bedrooms', { valueAsNumber: true })}
                placeholder="3"
              />
              {errors.bedrooms && (
                <p className="text-sm text-destructive">{errors.bedrooms.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms *</Label>
              <Input
                id="bathrooms"
                type="number"
                step="0.5"
                {...register('bathrooms', { valueAsNumber: true })}
                placeholder="2"
              />
              {errors.bathrooms && (
                <p className="text-sm text-destructive">{errors.bathrooms.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxGuests">Max Guests *</Label>
              <Input
                id="maxGuests"
                type="number"
                {...register('maxGuests', { valueAsNumber: true })}
                placeholder="6"
              />
              {errors.maxGuests && (
                <p className="text-sm text-destructive">{errors.maxGuests.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nightlyRate">Price per Night *</Label>
              <Input
                id="nightlyRate"
                type="number"
                step="0.01"
                {...register('nightlyRate', { valueAsNumber: true })}
                placeholder="150"
              />
              {errors.nightlyRate && (
                <p className="text-sm text-destructive">{errors.nightlyRate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                {...register('currency')}
                placeholder="EUR"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader>
          <CardTitle>Amenities</CardTitle>
          <CardDescription>Select all amenities available at the property</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {COMMON_AMENITIES.map((amenity) => (
              <div key={amenity} className="flex items-center space-x-2">
                <Checkbox
                  id={`amenity-${amenity}`}
                  checked={selectedAmenities.includes(amenity)}
                  onCheckedChange={() => toggleAmenity(amenity)}
                />
                <Label htmlFor={`amenity-${amenity}`} className="cursor-pointer text-sm">
                  {amenity}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : property ? 'Update Property' : 'Create Property'}
        </Button>
      </div>
    </form>
  );
}
