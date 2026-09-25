import { z } from 'zod';
import { optionalCinSchema } from '@/lib/cin-format';
import type { CreatePropertyDto, Property } from '@/types';

/** Time zone of a new property: the platform is for Italian rentals. */
export const DEFAULT_PROPERTY_TIMEZONE = 'Europe/Rome';

/**
 * Property form (short stays). Types and limits are the API ones (A2-27): whole bathrooms (the API stores an int),
 * 0 bedrooms for a studio flat, amounts in euros. No country nor currency field: the API has none.
 */
export const propertyFormSchema = z.object({
  name: z.string().min(3, 'property.validation.name.minLength').max(100, 'property.validation.name.maxLength'),
  description: z.string().min(10, 'property.validation.description.minLength').max(1000, 'property.validation.description.maxLength'),
  address: z.string().min(5, 'property.validation.address.required'),
  city: z.string().min(2, 'property.validation.city.required'),
  postalCode: z.string().min(3, 'property.validation.postalCode.required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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
  /** '' = no cancellation policy. */
  cancellationPolicyId: z.string(),
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

/**
 * Initial values of the form: the property being edited, or an empty property. The long-term form keeps the
 * short-stay fields hidden with these values and never sends them.
 */
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
    cinCode: property?.cinCode ?? '',
    slug: property?.slug ?? '',
    amenities: property?.amenities ?? [],
  };

  if (!property) {
    return {
      ...shortStayDefaults,
      // Long-term property: no short-stay rate nor guests until the owner lists it for short stays.
      ...(variant === 'long-rent' ? { nightlyRate: 0, maxGuests: 0 } : {}),
    };
  }

  return {
    ...shortStayDefaults,
    name: property.name,
    description: property.description,
    address: property.address,
    city: property.city,
    postalCode: property.postalCode,
    latitude: property.latitude,
    longitude: property.longitude,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    maxGuests: property.maxGuests,
    nightlyRate: property.nightlyRate,
  };
}

/**
 * API body of the form: every field the form shows (the API keeps the others, A2-04). Photos are not a form field
 * and are never sent from here, so a save cannot drop a photo uploaded meanwhile.
 */
export function toPropertyPayload(values: PropertyFormValues, variant: PropertyFormVariant): CreatePropertyDto {
  const payload: CreatePropertyDto = {
    name: values.name,
    description: values.description,
    address: values.address,
    city: values.city,
    postalCode: values.postalCode,
    latitude: values.latitude,
    longitude: values.longitude,
    bedrooms: values.bedrooms,
    bathrooms: values.bathrooms,
    maxGuests: values.maxGuests,
    nightlyRate: values.nightlyRate,
    amenities: values.amenities,
  };
  if (variant === 'long-rent') return payload;

  return {
    ...payload,
    cleaningFee: values.cleaningFee,
    damageDeposit: values.damageDeposit,
    houseRules: values.houseRules,
    timezone: values.timezone,
    cancellationPolicyId: values.cancellationPolicyId || null,
    cinCode: values.cinCode ?? '',
    slug: values.slug ?? '',
  };
}

// Exact C# PropertyAmenity enum names — used as API values
export const COMMON_AMENITIES = [
  'WiFi',
  'AirConditioning',
  'Heating',
  'Kitchen',
  'Washer',
  'Dryer',
  'TV',
  'FreeParking',
  'Pool',
  'HotTub',
  'Gym',
  'Elevator',
  'Balcony',
  'Terrace',
  'Garden',
  'BBQGrill',
  'Fireplace',
  'PetFriendly',
  'SmokeDetector',
  'FirstAidKit',
  'FireExtinguisher',
  'CarbonMonoxideDetector',
];

// Amenity labels are now resolved via getAmenityLabel() from @/lib/i18n-labels
// See amenity.{key} entries in locale JSONs
