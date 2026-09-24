import { z } from 'zod';
import { optionalCinSchema } from '@/lib/cin-format';

export const propertyFormSchema = z.object({
  name: z.string().min(3, 'property.validation.name.minLength').max(100, 'property.validation.name.maxLength'),
  description: z.string().min(10, 'property.validation.description.minLength').max(1000, 'property.validation.description.maxLength'),
  address: z.string().min(5, 'property.validation.address.required'),
  city: z.string().min(2, 'property.validation.city.required'),
  country: z.string().min(2, 'property.validation.country.required'),
  postalCode: z.string().min(3, 'property.validation.postalCode.required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  bedrooms: z.number().int().min(1, 'property.validation.bedrooms.min').max(50),
  bathrooms: z.number().min(0.5, 'property.validation.bathrooms.min').max(20),
  maxGuests: z.number().int().min(1, 'property.validation.maxGuests.min').max(100),
  nightlyRate: z.number().min(1, 'property.validation.nightlyRate.min').max(100000),
  currency: z.string(),
  amenities: z.array(z.string()),
  photoUrls: z.array(z.string()),
  isActive: z.boolean(),
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

/**
 * Long-term (LTR) property: no nightly rate nor short-stay guests (0 = not set, accepted by the API and blocking only
 * the short-stay listing activation). CIN and slug are not in the long-term form: whatever the property already has is
 * sent back unchanged and checked by the API, never blocked here by a field the landlord cannot see (A7-06).
 */
export const longRentPropertyFormSchema = propertyFormSchema.extend({
  maxGuests: z.number().int().min(0).max(100),
  nightlyRate: z.number().min(0).max(100000),
  cinCode: z.string().optional(),
  slug: z.string().optional(),
});

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
