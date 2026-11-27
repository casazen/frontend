import { LISTING_DESCRIPTION_MAX } from '@/lib/listing-texts';
import { z } from 'zod';
import { optionalCinSchema } from '@/lib/cin-format';
import type { CreatePropertyDto, Property } from '@/types';

export const DEFAULT_PROPERTY_TIMEZONE = 'Europe/Rome';

export const propertyFormSchema = z.object({
  name: z.string().min(3, 'property.validation.name.minLength').max(100, 'property.validation.name.maxLength'),
  description: z.string().min(10, 'property.validation.description.minLength').max(LISTING_DESCRIPTION_MAX, 'property.validation.description.maxLength'),
  address: z.string().min(5, 'property.validation.address.required'),
  unit: z.string().max(30, 'property.validation.unit.maxLength').optional(),
  city: z.string().min(2, 'property.validation.city.required'),
  /** ISTAT code of the comune chosen from the official list (SU-04); '' = none chosen. */
  comuneIstatCode: z.string().regex(/^[0-9]{6}$/, 'property.validation.comuneIstatCode.format').or(z.literal('')),
  swissMunicipalityCode: z
    .string()
    .regex(/^[0-9]{1,4}$/, 'property.validation.swissMunicipalityCode.format')
    .or(z.literal(''))
    .optional(),
  postalCode: z.string().min(3, 'property.validation.postalCode.required'),
  country: z.enum(['IT', 'CH']),
  currency: z.enum(['EUR', 'CHF']),
  latitude: z
    .number({ error: 'property.validation.latitude.range' })
    .min(-90, 'property.validation.latitude.range')
    .max(90, 'property.validation.latitude.range')
    .optional(),
  longitude: z
    .number({ error: 'property.validation.longitude.range' })
    .min(-180, 'property.validation.longitude.range')
    .max(180, 'property.validation.longitude.range')
    .optional(),
  bedrooms: z
    .number({ error: 'property.validation.bedrooms.min' })
    .int('property.validation.bedrooms.min')
    .min(0, 'property.validation.bedrooms.min')
    .max(100, 'property.validation.bedrooms.max'),
  bathrooms: z
    .number({ error: 'property.validation.bathrooms.min' })
    .int('property.validation.bathrooms.integer')
    .min(1, 'property.validation.bathrooms.min')
    .max(50, 'property.validation.bathrooms.max'),
  maxGuests: z.number().int().min(1, 'property.validation.maxGuests.min').max(100),
  nightlyRate: z.number().min(1, 'property.validation.nightlyRate.min').max(100000),
  cleaningFee: z
    .number({ error: 'property.validation.cleaningFee.range' })
    .min(0, 'property.validation.cleaningFee.range')
    .max(10000, 'property.validation.cleaningFee.range'),
  damageDeposit: z
    .number({ error: 'property.validation.damageDeposit.range' })
    .min(0, 'property.validation.damageDeposit.range')
    .max(50000, 'property.validation.damageDeposit.range'),
  houseRules: z.string().max(1000, 'property.validation.houseRules.maxLength'),
  timezone: z.string().min(1, 'property.validation.timezone.required').max(50, 'property.validation.timezone.required'),
  cancellationPolicyId: z.string(),
  cancellationFullRefundHours: z.preprocess(
    (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null),
    z.number().int().min(0).max(24 * 365).nullable(),
  ),
  cancellationPartialRefundHours: z.preprocess(
    (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null),
    z.number().int().min(0).max(24 * 365).nullable(),
  ),
  cancellationPartialRefundPercent: z.preprocess(
    (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null),
    z.number().min(0).max(100).nullable(),
  ),
  cancellationRefundType: z.enum(['Percent', 'NonRefundable']).optional(),
  amenities: z.array(z.string()),
  // Official CIN format, spaces/hyphens/case ignored: shared with the backend rule (src/lib/cin-format.ts).
  cinCode: optionalCinSchema,
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'property.validation.slug.format')
    .max(80, 'property.validation.slug.maxLength')
    .optional()
    .or(z.literal('')),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export type PropertyFormVariant = 'short-rent' | 'long-rent';

/**
 * Long-term (LTR) property: no nightly rate nor short-stay guests (0 = not set, accepted by the API and blocking only
 * the short-stay listing activation). The short-stay fields (CIN, slug, fees, house rules, time zone,
 * cancellation policy) are not in the long-term form and are not sent (see {@link toPropertyPayload}): the API keeps
 * what the property has (A7-06, A2-04), never blocked here by a field the landlord cannot see.
 */
export const longRentPropertyFormSchema = propertyFormSchema.extend({
  maxGuests: z.number().int().min(0).max(100),
  nightlyRate: z.number().min(0).max(100000),
  cinCode: z.string().optional(),
  slug: z.string().optional(),
});

export function propertyFormDefaults(
  property: Property | undefined,
  variant: PropertyFormVariant,
): Partial<PropertyFormValues> {
  const shortStayDefaults = {
    cleaningFee: property?.cleaningFee ?? 0,
    damageDeposit: property?.damageDeposit ?? 0,
    houseRules: property?.houseRules ?? '',
    timezone: property?.timezone || DEFAULT_PROPERTY_TIMEZONE,
    cancellationPolicyId: property?.cancellationPolicyId ?? '',
    cancellationFullRefundHours: property?.cancellationFullRefundHours ?? null,
    cancellationPartialRefundHours: property?.cancellationPartialRefundHours ?? null,
    cancellationPartialRefundPercent: property?.cancellationPartialRefundPercent ?? null,
    cancellationRefundType: property?.cancellationRefundType ?? 'Percent',
    cinCode: property?.cinCode ?? '',
    slug: property?.slug ?? '',
    amenities: property?.amenities ?? [],
  };

  if (!property) {
    return {
      ...shortStayDefaults,
      comuneIstatCode: '',
      swissMunicipalityCode: '',
      country: 'IT' as const,
      currency: 'EUR' as const,
      ...(variant === 'long-rent' ? { nightlyRate: 0, maxGuests: 0 } : {}),
    };
  }

  return {
    ...shortStayDefaults,
    name: property.name,
    description: property.description,
    address: property.address,
    unit: property.unit ?? '',
    city: property.city,
    comuneIstatCode: property.comuneIstatCode ?? '',
    swissMunicipalityCode: property.swissMunicipalityCode ?? '',
    postalCode: property.postalCode,
    latitude: property.latitude,
    longitude: property.longitude,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    maxGuests: property.maxGuests,
    nightlyRate: property.nightlyRate,
    country: property.country,
    currency: property.currency,
  };
}

export function toPropertyPayload(values: PropertyFormValues, variant: PropertyFormVariant): CreatePropertyDto {
  const payload: CreatePropertyDto = {
    name: values.name,
    description: values.description,
    address: values.address,
    unit: values.unit?.trim() ? values.unit.trim() : null,
    city: values.city,
    comuneIstatCode: values.comuneIstatCode || null,
    postalCode: values.postalCode,
    latitude: values.latitude,
    longitude: values.longitude,
    bedrooms: values.bedrooms,
    bathrooms: values.bathrooms,
    maxGuests: values.maxGuests,
    nightlyRate: values.nightlyRate,
    amenities: values.amenities,
    country: values.country,
    currency: values.currency,
    // The municipality the host confirmed from the official Swiss directory (E29/F01/US02/T01), only for a property in Switzerland: null
    // (nothing confirmed) clears the stored one on an update, and a create stores none. A property of Italy never sends it: the server
    // clears it itself when an imported draft changes country, and a save of another field must not touch what it keeps.
    ...(values.country === 'CH' ? { swissMunicipalityCode: values.swissMunicipalityCode || null } : {}),
  };
  if (variant === 'long-rent') return payload;

  return {
    ...payload,
    cleaningFee: values.cleaningFee,
    damageDeposit: values.damageDeposit,
    houseRules: values.houseRules,
    timezone: values.timezone,
    cancellationPolicyId: values.cancellationPolicyId || null,
    cancellationFullRefundHours: values.cancellationFullRefundHours ?? null,
    cancellationPartialRefundHours: values.cancellationPartialRefundHours ?? null,
    cancellationPartialRefundPercent: values.cancellationPartialRefundPercent ?? null,
    cancellationRefundType: values.cancellationRefundType ?? 'Percent',
    cinCode: values.cinCode ?? '',
    slug: values.slug ?? '',
  };
}
